# 04 — Regras de negócio

Este documento é a autoridade sobre cobrança. Ele **substitui** o `FleetFlow_Regras_Medicao.pdf` original (maio/2026), que tratava "ativação = entrada" e "desmobilização = saída" como sinônimos — uma simplificação que se mostrou errada.

---

## O modelo de duas dimensões

Toda movimentação tem **dois campos independentes**:

| Campo | Valores | Significa |
|---|---|---|
| `tipo_carro` | `ativacao` \| `desmobilizacao` | a natureza do veículo: 0 km entrando na frota, ou usado saindo dela |
| `movimento` | `entrada` \| `saida` | o que está acontecendo agora: o carro está chegando ou indo embora |

São quatro combinações possíveis. Confundi-las é a causa histórica número 1 de erro de faturamento.

## Matriz de cobrança — Stellantis

| Tipo do carro | Movimento | O que é cobrado |
|---|---|---|
| Ativação | **Entrada** | Taxa de ativação **R$ 190 / R$ 123,50** + 1ª diária |
| Ativação | Saída | **Nada.** Só fecha o ciclo |
| Desmobilização | **Entrada** | Taxa de desmobilização **R$ 88 / R$ 57,20** + 1ª diária |
| Desmobilização | Saída | **Nada.** Só fecha o ciclo |

O padrão: **a entrada cobra a taxa do tipo mais a primeira diária; a saída não cobra nada.** As diárias intermediárias vêm do cron.

**A taxa é definida pelo tipo da ENTRADA e não muda depois.** Se um carro entra como ativação e sai classificado como outra coisa, a taxa de R$ 190 já cobrada permanece. Decisão registrada em 14/08/2026 (caso TDZ4D72, que saiu como "Venda Seminovo").

**"Venda Seminovo"** — tipo de operação que passou a aparecer nos PDFs da Vexsoft — deve ser cobrado **como desmobilização**.

## Diárias

| | Cliente (Stellantis) | Parceiro (pátio) |
|---|---|---|
| Valor | R$ 10,00/dia | R$ 6,50/dia |
| Carência | **7 dias** — dias 1 a 7 saem R$ 0 | nenhuma — cobra desde o dia 1 |

- A **primeira diária** é lançada junto com a taxa, no momento da entrada.
- As **demais** são lançadas pelo cron `launch_daily_charges`, todo dia às **07:05 (America/Bahia)**, uma por veículo com `status = 'patio'`.
- **O dia de entrada e o dia de saída contam.**
- O cron é idempotente: não duplica a diária de um dia já lançado.

## Extras

Nunca aparecem no aplicativo do operador. **Só o admin lança**, por SQL, quando é avisado.

| Serviço | Cliente | Parceiro |
|---|---|---|
| `remocao_plotagem` | R$ 350,00 | R$ 50,00 |
| `reset_luz_painel` | R$ 250,00 | R$ 100,00 |
| `troca_vidro_triangular` | R$ 2.500,00 | R$ 1.500,00 |

Antes de lançar um extra, **sempre confira que a placa existe** — ver [o que nunca fazer](#o-que-nunca-fazer).

## Contrato Unidas — guarda em Salvador

Modelo completamente diferente: **não gera `vehicle_service_charges`**. A conta sai da ocupação diária.

- R$ 6,00 por carro-dia
- Piso mensal de **R$ 9.000**, equivalente a 50 carros/dia
- Vigência desde **27/07/2026**

```
fatura_do_mês = 9.000 + Σ dias  máx(0, carros_unidas_no_dia − 50) × 6
```

No PWA o fluxo Unidas é **só entrada e saída**, sem escolher tipo de carro e sem gerar nenhuma cobrança. O seletor de cliente só aparece para o operador de **SSA** — o contrato é exclusivo de Salvador, e o servidor recusa um lançamento Unidas vindo de outro pátio.

## Contrato Refran — custo do pátio em Salvador

- 50 vagas por **R$ 3.500/mês**
- Excedente a **R$ 4,00 por carro-dia**
- **A ocupação conta Stellantis + Unidas somados**
- Vigência desde **27/07/2026**

## Margem da guarda

```
margem = fatura_Unidas − repasse_Refran
```

Com os dois lados dentro dos respectivos limites, o piso é **R$ 9.000 − R$ 3.500 = R$ 5.500/mês**. Acima disso, cada carro-dia excedente rende R$ 6 de receita contra R$ 4 de custo — um *spread* de R$ 2.

O detalhe que muda tudo: **os gatilhos de excedente são diferentes**. O da Unidas conta só os carros Unidas acima de 50; o da Refran conta a ocupação **total** do pátio acima de 50 vagas. Como já havia carros Stellantis em SSA quando o contrato começou, o pátio estoura as 50 vagas da Refran muito antes de a Unidas sozinha chegar a 50. O dashboard tem um **simulador** justamente para dimensionar isso numa renegociação.

## Como a medição mensal é calculada

**Stellantis:** somatório de `client_charge` em `vehicle_service_charges` no intervalo do mês, com dois filtros obrigatórios:

- `status <> 'cancelled'` — um terço das linhas está cancelada
- veículos com `status = 'archived'` fora da conta (são testes e registros inválidos)

A Unidas **não entra** na medição Stellantis; tem apuração própria por ocupação.

**Unidas:** série de `daily_occupancy` do mês filtrada por `occ_date >= contrato.starts_on`, aplicando a fórmula do piso mais excedentes.

---

## O que nunca fazer

Três regras vieram de erros reais e custaram dinheiro ou retrabalho. Valem para qualquer feature nova.

### 1. Um print = um evento

Cada foto enviada pelo operador representa **um único** movimento. Ao processar uma desmobilização, lance a desmobilização e as diárias — **não** lance uma ativação retroativa só porque não existe cobrança de ativação anterior no banco. Isso é problema de outro print. Da mesma forma, ao processar uma ativação, não antecipe diárias nem saída.

*Origem: 18/05/2026, veículo TZD7D87 — um único print de "Saída" gerou ativação e desmobilização ao mesmo tempo.*

### 2. Nunca mostrar valores ao operador

As telas usadas por Bira, Diego e Marcos **não podem exibir R$, totais, custos ou qualquer informação comercial**. Só placa, modelo, badges de tipo/movimento e data. Eles são prestadores terceirizados e não devem saber quanto a Stellantis paga nem quanto o pátio recebe.

*Origem: 25/05/2026 — a tela de sucesso mostrava "Taxa Ativação R$ 190 / Total cliente R$ 190 / Custo parceiro R$ 130".*

### 3. Conferir a placa antes de lançar um extra

Fluxo obrigatório:

1. `SELECT id, plate, status FROM vehicles WHERE plate IN (...)`
2. Se não houver correspondência exata, buscar por semelhança (`ILIKE '%parte%'`) e **apresentar os candidatos**
3. Só inserir a cobrança **depois de confirmado o `vehicle_id`**

Uma cobrança sem veículo válido vira órfã e some da medição.

*Origem: 30/05/2026 — dois extras de retirada de adesivo pedidos para placas que não existiam no banco.*

---

## Outras decisões estruturais

**OS da oficina não entram na medição.** Peças e serviços das ordens de serviço são faturamento separado (Proline). A planilha de OS serve apenas como fonte confiável de **datas de saída**.

**A coluna "DATA DA OS" não é a data de entrada no pátio.** É a data de abertura da ordem de serviço, quase sempre posterior. Usar essa coluna como entrada já produziu diárias erradas.

**Conferência física é a fonte de verdade** — e, entre duas evidências físicas, **listas com data prevalecem sobre fotos de posição**. Fotos podem estar desatualizadas.

**Semântica das vistorias Vexsoft:**

- **Desmobilização** tem vistoria na entrada (recebimento) **e** na saída → dois PDFs por carro.
- **Ativação** historicamente só tinha vistoria na **saída** (entrega do 0 km) → um PDF, que marca a **saída**, não a entrada. `km = 0` confirma que é ativação.
- Desde agosto/2026 ficou combinado com a Stellantis que a ativação passa a ter vistoria também na entrada.

**Backlog vale de dezembro/2025 em diante.** Todos os carros do período devem ter cobrança, preenchida com a mesma lógica e a mesma tabela de preços.
