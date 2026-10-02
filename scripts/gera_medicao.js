#!/usr/bin/env node
/* Gera a planilha da medição mensal Stellantis (formato "Demonstrativo de Faturamento")
 * fora do navegador, com o MESMO código do botão Excel do dashboard (../medicao.js).
 *
 *   cd scripts && npm install          (uma vez — instala exceljs)
 *   node gera_medicao.js 2026 9 [pasta-de-saida]
 *
 * Lê os veículos direto do Supabase (chave anon, mesma do dashboard) e grava DUAS pastas,
 * "MM.AAAA - Apuracao Ativacao <Mês> <Ano> - CPB.xlsx" e "... Apuracao Desmobilizacao ...", na pasta de saída
 * (padrão: a pasta atual). Imprime o total por praça/serviço para conferência.
 */
const path = require('path');
const ExcelJS = require('exceljs');
const M = require('../medicao.js');

const SUPABASE_URL = 'https://sqbjxabftqtzdigjhivl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxYmp4YWJmdHF0emRpZ2poaXZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzg2MjgsImV4cCI6MjA4ODgxNDYyOH0.HjuiYMBq6I2z43qCA7TwdagqFnZ6WgyeqXQHcE3aMsY';

async function fetchVehicles() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/vehicles?select=*&order=estimated_arrival_date`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Range: `${from}-${from + 999}`, Prefer: 'count=exact' }
    });
    if (!r.ok && r.status !== 206) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    const page = await r.json();
    all.push(...page);
    if (page.length < 1000) break;
  }
  return all;
}

(async () => {
  const [, , y, m, outDir] = process.argv;
  if (!y || !m) { console.error('uso: node gera_medicao.js <ano> <mes 1-12> [pasta-de-saida]'); process.exit(2); }
  const year = Number(y), month = Number(m) - 1;
  const vehicles = await fetchVehicles();
  const rows = M.calcMeasurementRows(vehicles, year, month);
  for (const { wb, blocos, naoClassificados, servico, nome } of M.buildMedicoesMes(rows, year, month, ExcelJS)) {
    for (const b of blocos) console.log(`${b.praca} ${b.tipo.padEnd(14)} ${String(b.n).padStart(3)} veíc.  diárias ${b.custodia}  check list ${b.fee}  total ${b.total}`);
    const sub = rows.filter(r => r.tipo === servico);
    console.log(`TOTAL ${servico}: ${sub.length} veículos  R$ ${sub.reduce((s, r) => s + r.total, 0)}`);
    if (naoClassificados.length) console.warn('SEM PRAÇA/TIPO (fora das planilhas):', naoClassificados.map(r => r.plate).join(', '));
    const out = path.join(outDir || process.cwd(), nome);
    await wb.xlsx.writeFile(out);
    console.log('gravado:', out);
  }
})().catch(e => { console.error(e); process.exit(1); });
