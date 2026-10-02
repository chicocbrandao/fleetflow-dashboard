/* FleetFlow — Medição mensal Stellantis
 * Código compartilhado entre o dashboard (index.html) e scripts Node.
 *  - calcMeasurementRows(): uma linha por veículo com permanência no mês
 *  - buildMedicaoStellantis(): pasta .xlsx no layout "Demonstrativo de Faturamento"
 *    que a Stellantis pediu (aba "Validação" do arquivo de agosto/2026)
 * Depende de ExcelJS (global `ExcelJS` no browser, require('exceljs') no Node).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else Object.assign(root, factory());
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RULES = { GRACE: 7, DIARIA: 10, ATIV_FEE: 190, DESM_FEE: 88 };
  const UNIDAS_ID = 'fea28c45-8ca5-4550-98ad-3f9e78b7a120';
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MES_ABREV = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const PRACA_NOME = { SSA: 'Salvador', REC: 'Recife', NAT: 'Natal' };
  const PRACA_ORDEM = { SSA: 1, REC: 2, NAT: 3 };
  const DAY = 86400000;

  function parsePraca(notes) {
    if (!notes) return '?';
    if (notes.includes('NAT')) return 'NAT';
    if (notes.includes('REC')) return 'REC';
    if (notes.includes('SSA')) return 'SSA';
    return '?';
  }

  function parseType(notes) {
    if (!notes) return '?';
    const up = notes.toUpperCase();
    if (up.includes('GUARDA')) return 'Guarda Unidas';
    // O tipo do carro é a palavra ATIVACAO/DESMOBILIZACAO que aparece PRIMEIRO
    // (o 1º segmento das notes é a entrada, que define o serviço cobrado).
    const iA = Math.min(...['ATIVAÇÃO','ATIVACAO'].map(t => up.indexOf(t)).filter(i => i >= 0).concat(Infinity));
    const iD = Math.min(...['DESMOBILIZAÇÃO','DESMOBILIZACAO','DESMOB'].map(t => up.indexOf(t)).filter(i => i >= 0).concat(Infinity));
    if (iA < iD) return 'Ativação';
    if (iD < iA) return 'Desmobilização';
    if (up.includes('ENTRADA')) return 'Ativação';
    if (up.includes('SAÍDA') || up.includes('SAIDA')) return 'Desmobilização';
    return '?';
  }

  const utc = s => new Date(s.slice(0, 10) + 'T00:00:00Z');
  const iso = d => d.toISOString().slice(0, 10);
  const br = s => { if (!s) return ''; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
  function modelo(v) {
    const b = (v.brand || '').trim(), m = (v.model || '').trim();
    if (!b) return m;
    return m.toUpperCase().startsWith(b.toUpperCase()) ? m : `${b} ${m}`;
  }

  /**
   * Uma linha por veículo Stellantis com permanência no mês (year, month 0-based).
   * Regras: diária R$10 por dia (entrada e saída contam); carência de GRACE dias
   * corridos a partir da entrada (dia da entrada + 6); taxa de serviço (190 ativação /
   * 88 desmobilização) lançada no mês da entrada. O mês corrente é cortado em "hoje".
   */
  function calcMeasurementRows(vehicles, year, month, opts) {
    const R = Object.assign({}, RULES, opts || {});
    const today = new Date(); const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const mStart = new Date(Date.UTC(year, month, 1));
    const mLast = new Date(Date.UTC(year, month + 1, 0));
    const mEnd = todayUtc < mLast ? todayUtc : mLast;

    const rows = [];
    for (const v of vehicles) {
      if (v.client_id === UNIDAS_ID) continue;
      if (!v.estimated_arrival_date) continue;
      if (v.status === 'archived' || v.status === 'arquivado') continue;
      const entrada = utc(v.estimated_arrival_date);
      if (entrada > mEnd) continue;
      const saidaReal = v.withdrawal_date ? utc(v.withdrawal_date) : null;
      if (saidaReal && saidaReal < mStart) continue;

      const tipo = parseType(v.notes);
      const praca = v.yard || parsePraca(v.notes);
      const saidaCalc = saidaReal && saidaReal <= mEnd ? saidaReal : mEnd;
      const startCount = entrada > mStart ? entrada : mStart;
      const diarias = Math.max(0, Math.round((saidaCalc - startCount) / DAY) + 1);

      // último dia isento = entrada + (GRACE-1); dias isentos dentro da janela do mês
      const graceLast = new Date(entrada.getTime() + (R.GRACE - 1) * DAY);
      const gEnd = graceLast < saidaCalc ? graceLast : saidaCalc;
      const graceInMonth = Math.max(0, Math.round((gEnd - startCount) / DAY) + 1);

      const diasCobr = Math.max(0, diarias - graceInMonth);
      const custodia = diasCobr * R.DIARIA;
      const enteredThisMonth = entrada >= mStart && entrada <= mEnd;
      const fee = enteredThisMonth ? (tipo === 'Ativação' ? R.ATIV_FEE : tipo === 'Desmobilização' ? R.DESM_FEE : 0) : 0;
      const saiu = !!(saidaReal && saidaReal <= mEnd);

      rows.push({
        plate: v.plate, model: modelo(v), tipo, praca,
        entrada: v.estimated_arrival_date.slice(0, 10),
        saida: saiu ? iso(saidaReal) : null,
        periodoIni: iso(startCount), periodoFim: iso(saidaCalc),
        diarias, graceInMonth, diasCobr, custodia, fee, total: custodia + fee,
        enteredThisMonth, status: saiu ? 'FINALIZADO' : 'PÁTIO', notes: v.notes || ''
      });
    }
    rows.sort((a, b) => (PRACA_ORDEM[a.praca] || 9) - (PRACA_ORDEM[b.praca] || 9)
      || a.tipo.localeCompare(b.tipo) || a.entrada.localeCompare(b.entrada) || a.plate.localeCompare(b.plate));
    return rows;
  }

  function observacao(m) {
    const p = [];
    p.push(m.saida ? `Saída em ${br(m.saida)}` : `Em custódia em ${br(m.periodoFim)}`);
    if (m.enteredThisMonth) p.push(`entrada em ${br(m.entrada)} — serviço lançado; carência de ${RULES.GRACE} dias`);
    else if (m.graceInMonth > 0) p.push(`entrada em ${br(m.entrada)} — carência residual de ${m.graceInMonth} dia(s)`);
    else p.push(`remanescente — entrada em ${br(m.entrada)}, carência consumida`);
    const up = (m.notes || '').toUpperCase();
    if (up.includes('CONSTATACAO') || up.includes('CONSTATAÇÃO')) p.push('saída por constatação na auditoria física de 09-10/09 — data real a confirmar com a Stellantis');
    if (up.includes('PLACA REAL E TYH8D65')) p.push('placa física TYH8D65 (cadastro grafado TVH8D65)');
    return p.join('; ');
  }

  // ───────────────────────── XLSX ─────────────────────────
  const C = { AZUL: 'FF0070C0', NAVY: 'FF1F4E79', AZUL2: 'FF2E75B6', CLARO: 'FFDEEAF1', CLARO2: 'FFEBF3FB', AMARELO: 'FFFFF2CC', BRANCO: 'FFFFFFFF', CINZA: 'FF595959' };
  const FMT_RS = '_-"R$"\\ * #,##0.00_-;\\-"R$"\\ * #,##0.00_-;_-"R$"\\ * "-"??_-;_-@_-';
  const FMT_RS_INT = '"R$ "#,##0;"(R$ "#,##0\\);\\-';
  const FMT_DATA = 'dd/mm/yyyy';
  const thin = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  const BORDA = { top: thin, left: thin, bottom: thin, right: thin };
  const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const dateCell = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

  function sheetName(praca, tipo) { return `${praca} - ${tipo === 'Ativação' ? 'Ativação' : 'Desmob'}`; }

  function addDemonstrativo(wb, praca, tipo, rows, year, month, ExcelJS) {
    const ws = wb.addWorksheet(sheetName(praca, tipo), { views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }] });
    const mesNome = MESES[month], mesAb = MES_ABREV[month];
    const n = rows.length, first = 3, last = Math.max(first, first + n - 1);
    const titulo = tipo === 'Ativação'
      ? `Demonstrativo de Faturamento Zero KM  CPB ref. ${mesNome}/${year}  —  ${PRACA_NOME[praca] || praca} (${praca})`
      : `Demonstrativo de Faturamento Desmobilização  CPB ref. ${mesNome}/${year}  —  ${PRACA_NOME[praca] || praca} (${praca})`;

    ws.columns = [
      { width: 10 }, { width: 24 }, { width: 14.7 }, { width: 17.2 }, { width: 17.5 }, { width: 11 }, { width: 9.3 }, { width: 9 },
      { width: 11 }, { width: 13 }, { width: 12.5 }, { width: 9 }, { width: 13 }, { width: 15 }, { width: 58 }, { width: 10 }, { width: 24 }
    ];

    // linha 1 — título + subtotais (SUBTOTAL respeita filtro)
    const r1 = ws.getRow(1); r1.height = 23.5;
    for (let c = 1; c <= 17; c++) { const cell = r1.getCell(c); cell.fill = fill(C.AZUL); cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: C.BRANCO } }; }
    r1.getCell(1).value = titulo; r1.getCell(1).font = { name: 'Calibri', size: 18, bold: true, color: { argb: C.BRANCO } }; r1.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    ws.mergeCells(1, 1, 1, 9);
    for (const col of ['J', 'K', 'L', 'M', 'N']) {
      const cell = ws.getCell(`${col}1`);
      cell.value = n ? { formula: `SUBTOTAL(9,${col}${first}:${col}${last})`, result: rows.reduce((s, m) => s + ({ J: m.custodia, K: m.fee, N: m.total }[col] || 0), 0) } : 0;
      cell.numFmt = '"R$"\\ #,##0.00'; cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // linha 2 — cabeçalho (textos iguais aos da aba Validação da Stellantis)
    const header = ['Placa', 'Modelo ', 'Data  Inicial  Entrada ', `Período de Cobrança INICIO ${mesAb}/${year}`, `Periodo de Cobrança  FINAL ${mesAb}/${year}`,
      'Valor da Diária', 'Qtd Diárias', 'Carência Diárias', 'Desconto carência', 'Valor Devido Diárias', 'Valor do Check List', 'Lavagem', 'Abastecimento',
      'Valor Final Cobrado Por Placa', 'OBSERVAÇÕES:', 'Validação', 'Comentários'];
    const r2 = ws.getRow(2); r2.height = 39;
    header.forEach((h, i) => { const cell = r2.getCell(i + 1); cell.value = h; cell.font = { name: 'Calibri', size: 10, bold: true }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = BORDA; cell.fill = fill(C.CLARO); });

    // dados
    rows.forEach((m, i) => {
      const r = first + i; const row = ws.getRow(r);
      const vals = [
        m.plate, m.model, dateCell(m.entrada), dateCell(m.periodoIni), dateCell(m.periodoFim), RULES.DIARIA,
        { formula: `E${r}-D${r}+1`, result: m.diarias },
        m.graceInMonth || null,
        { formula: `F${r}*H${r}`, result: m.graceInMonth * RULES.DIARIA },
        { formula: `MAX(0,(G${r}*F${r})-I${r})`, result: m.custodia },
        m.fee || null, null, null,
        { formula: `SUM(J${r}:M${r})`, result: m.total },
        observacao(m), null, null
      ];
      vals.forEach((v, c) => {
        const cell = row.getCell(c + 1); cell.value = v; cell.border = BORDA;
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { horizontal: c === 14 ? 'left' : 'center', vertical: 'middle', wrapText: c === 14 };
      });
      ['C', 'D', 'E'].forEach(col => ws.getCell(`${col}${r}`).numFmt = FMT_DATA);
      ['F', 'I', 'J', 'K', 'L', 'M', 'N'].forEach(col => ws.getCell(`${col}${r}`).numFmt = FMT_RS);
      ws.getCell(`N${r}`).font = { name: 'Calibri', size: 10, bold: true };
      row.height = 27;
    });
    if (!n) { const cell = ws.getCell(`A${first}`); cell.value = 'Sem veículos neste período'; ws.mergeCells(first, 1, first, 17); cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: C.CINZA } }; }

    // total
    const rt = last + 2; const rowT = ws.getRow(rt);
    rowT.getCell(1).value = `TOTAL ${praca} — ${tipo.toUpperCase()} — ${n} veículo(s)`; ws.mergeCells(rt, 1, rt, 9);
    for (const col of ['J', 'K', 'L', 'M', 'N']) {
      const cell = ws.getCell(`${col}${rt}`);
      cell.value = n ? { formula: `SUM(${col}${first}:${col}${last})`, result: rows.reduce((s, m) => s + ({ J: m.custodia, K: m.fee, N: m.total }[col] || 0), 0) } : 0;
      cell.numFmt = FMT_RS;
    }
    for (let c = 1; c <= 17; c++) { const cell = rowT.getCell(c); cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.BRANCO } }; cell.fill = fill(C.NAVY); cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center' }; }
    rowT.height = 19.5;

    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: last, column: 17 } };
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    return { ws, totalRow: rt, n };
  }

  function addResumo(wb, blocos, year, month, rows, servico) {
    const SERV = servico === 'Ativação' ? 'ATIVAÇÃO 0K' : 'DESMOBILIZAÇÃO';
    const ws = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    const mesNome = MESES[month]; const ultimo = rows.length ? rows.reduce((a, m) => m.periodoFim > a ? m.periodoFim : a, '0') : '';
    ws.columns = [{ width: 2 }, { width: 44 }, { width: 8 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 70 }];
    const put = (ref, v, font, fillArgb, numFmt, align) => { const c = ws.getCell(ref); c.value = v; if (font) c.font = Object.assign({ name: 'Calibri' }, font); if (fillArgb) c.fill = fill(fillArgb); if (numFmt) c.numFmt = numFmt; if (align) c.alignment = align; return c; };

    ws.mergeCells('B1:G1'); put('B1', `RESUMO — ${SERV}  ·  ${mesNome.toUpperCase()} ${year}  ·  FleetFlow · Stellantis  ·  CPB Auto Peças`, { size: 12, bold: true, color: { argb: C.BRANCO } }, C.NAVY, null, { vertical: 'middle' });
    ws.getRow(1).height = 21.75;
    ws.mergeCells('B2:G2'); put('B2', `Competência: 01/${String(month + 1).padStart(2, '0')}/${year} a ${br(ultimo)}  |  Praças: Salvador (SSA), Recife (REC) e Natal (NAT)  |  Serviço: ${servico === 'Ativação' ? 'Ativação 0 km' : 'Desmobilização'}  |  Fatura a emitir: ${MESES[(month + 1) % 12]}/${month === 11 ? year + 1 : year}`, { size: 10, bold: true, color: { argb: C.NAVY } }, C.CLARO, null, { vertical: 'middle', wrapText: true });
    ws.getRow(2).height = 30;

    const hdr = ['PRAÇA / SERVIÇO', 'VEÍC.', 'DIÁRIAS (R$)', 'CHECK LIST (R$)', 'TOTAL (R$)', 'OBSERVAÇÃO'];
    hdr.forEach((h, i) => put(ws.getCell(4, i + 2).address, h, { size: 9, bold: true, color: { argb: C.BRANCO } }, C.AZUL2, null, { horizontal: 'center', vertical: 'middle', wrapText: true }));
    ws.getRow(4).height = 24;

    let r = 5;
    for (const b of blocos) {
      const q = `'${b.name}'`;
      put(`B${r}`, `${b.praca} — ${b.tipo === 'Ativação' ? 'Ativação 0K' : 'Desmobilização'}  (${b.n} veíc.)`, { size: 10 }, C.CLARO2);
      put(`C${r}`, b.n, { size: 10 }, C.CLARO2, null, { horizontal: 'center' });
      put(`D${r}`, { formula: `${q}!J${b.totalRow}`, result: b.custodia }, { size: 10, color: { argb: 'FF008000' } }, C.CLARO2, FMT_RS_INT);
      put(`E${r}`, { formula: `${q}!K${b.totalRow}`, result: b.fee }, { size: 10, color: { argb: 'FF008000' } }, C.CLARO2, FMT_RS_INT);
      put(`F${r}`, { formula: `${q}!N${b.totalRow}`, result: b.total }, { size: 10, color: { argb: 'FF008000' } }, C.CLARO2, FMT_RS_INT);
      put(`G${r}`, b.tipo === 'Ativação' ? 'Serviço R$ 190,00/chegada | Diária R$ 10,00 | Carência 7 dias' : 'Serviço R$ 88,00/chegada | Diária R$ 10,00 | Carência 7 dias', { size: 9, color: { argb: C.CINZA } }, C.CLARO2);
      ws.getRow(r).height = 18; r++;
    }
    for (const p of ['SSA', 'REC', 'NAT']) {
      if (!blocos.some(b => b.praca === p)) {
        put(`B${r}`, `${p} — sem ${servico === 'Ativação' ? 'ativação' : 'desmobilização'} em ${mesNome.toLowerCase()}`, { size: 10, italic: true, color: { argb: C.CINZA } }, C.CLARO2);
        put(`C${r}`, 0, { size: 10 }, C.CLARO2, null, { horizontal: 'center' });
        ['D', 'E', 'F'].forEach(col => put(`${col}${r}`, 0, { size: 10 }, C.CLARO2, FMT_RS_INT));
        put(`G${r}`, '', null, C.CLARO2); ws.getRow(r).height = 18; r++;
      }
    }
    const rt = r + 1;
    put(`B${rt}`, `⭐  TOTAL ${SERV} — ${mesNome.toUpperCase()} ${year}`, { size: 11, bold: true, color: { argb: C.BRANCO } }, C.NAVY);
    put(`C${rt}`, { formula: `SUM(C5:C${r - 1})`, result: rows.length }, { size: 11, bold: true, color: { argb: C.BRANCO } }, C.NAVY, null, { horizontal: 'center' });
    ['D', 'E', 'F'].forEach(col => put(`${col}${rt}`, { formula: `SUM(${col}5:${col}${r - 1})`, result: rows.reduce((s, m) => s + ({ D: m.custodia, E: m.fee, F: m.total }[col]), 0) }, { size: 11, bold: true, color: { argb: C.BRANCO } }, C.NAVY, FMT_RS_INT));
    put(`G${rt}`, '', null, C.NAVY); ws.getRow(rt).height = 19.5;

    const notas = [
      `Regras aplicadas: diária R$ 10,00 por dia de permanência (dia de entrada e dia de saída contam); carência de 7 dias corridos a partir da entrada; taxa de serviço (check list) lançada uma vez, no mês da entrada: ${servico === 'Ativação' ? 'R$ 190,00 por ativação 0 km' : 'R$ 88,00 por desmobilização'}.`,
      'Cada aba "PRAÇA - Serviço" segue o layout do Demonstrativo de Faturamento (aba Validação enviada pela Stellantis): colunas, fórmulas e totais com SUBTOTAL na linha 1 (respeitam o filtro). As colunas Validação e Comentários ficam em branco para preenchimento da Stellantis.',
      'Veículos remanescentes de meses anteriores entram com período de cobrança a partir do dia 1º e sem carência; veículos que entraram no mês trazem a carência na coluna "Carência Diárias".',
      `Gerado pelo FleetFlow em ${br(iso(new Date()))}.`
    ];
    let rn = rt + 2;
    for (const t of notas) { ws.mergeCells(`B${rn}:G${rn}`); put(`B${rn}`, t, { size: 9, color: { argb: C.CINZA } }, null, null, { wrapText: true, vertical: 'top' }); ws.getRow(rn).height = 30; rn++; }
    return ws;
  }

  /** Monta a pasta de UM serviço ('Ativação' | 'Desmobilização'). rows = calcMeasurementRows(...).
   *  Devolve { wb, blocos, naoClassificados, servico, nome }. */
  function buildMedicaoStellantis(rows, year, month, ExcelJSLib, servico) {
    const ExcelJS = ExcelJSLib || (typeof require === 'function' ? require('exceljs') : self.ExcelJS);
    if (!servico) servico = 'Ativação';
    const wb = new ExcelJS.Workbook();
    wb.creator = 'FleetFlow'; wb.created = new Date();
    const resumoPlaceholder = wb.addWorksheet('Resumo'); // garante 1ª posição; substituída abaixo
    const blocos = [];
    const doServico = rows.filter(m => m.tipo === servico);
    for (const praca of ['SSA', 'REC', 'NAT']) {
      const sub = doServico.filter(m => m.praca === praca);
      if (!sub.length) continue;
      const { totalRow, n } = addDemonstrativo(wb, praca, servico, sub, year, month, ExcelJS);
      blocos.push({ name: sheetName(praca, servico), praca, tipo: servico, n, totalRow,
        custodia: sub.reduce((s, m) => s + m.custodia, 0), fee: sub.reduce((s, m) => s + m.fee, 0), total: sub.reduce((s, m) => s + m.total, 0) });
    }
    wb.removeWorksheet(resumoPlaceholder.id);
    const resumo = addResumo(wb, blocos, year, month, doServico, servico);
    // move Resumo para a frente
    wb.worksheets.forEach((w, i) => { w.orderNo = w === resumo ? 0 : i + 1; });
    const outros = rows.filter(m => !['SSA', 'REC', 'NAT'].includes(m.praca) || !['Ativação', 'Desmobilização'].includes(m.tipo));
    return { wb, blocos, naoClassificados: outros, servico, nome: nomeArquivo(year, month, servico) };
  }

  /** As duas pastas do mês (Ativação e Desmobilização), na ordem. */
  function buildMedicoesMes(rows, year, month, ExcelJSLib) {
    return ['Ativação', 'Desmobilização'].map(s => buildMedicaoStellantis(rows, year, month, ExcelJSLib, s));
  }

  // Ex.: "09.2026 - Apuracao Ativacao Setembro 2026 - CPB.xlsx" (mesmo padrão do envio de agosto)
  function nomeArquivo(year, month, servico) {
    const serv = servico === 'Desmobilização' ? 'Desmobilizacao' : 'Ativacao';
    return `${String(month + 1).padStart(2, '0')}.${year} - Apuracao ${serv} ${MESES[month]} ${year} - CPB.xlsx`;
  }

  return { RULES, UNIDAS_ID, MESES, parsePraca, parseType, calcMeasurementRows, buildMedicaoStellantis, buildMedicoesMes, nomeArquivo, observacao };
}));
