# 01 — Visão geral

## O que o FleetFlow faz

O FleetFlow controla a **entrada, permanência e saída de veículos em pátios terceirizados** e transforma esses movimentos em **cobrança para o cliente** e **custo para o parceiro**. Dois contratos convivem no mesmo sistema, com modelos de cobrança completamente diferentes:

**Stellantis — serviço de pátio (SSA, REC, NAT).** Cada veículo é cobrado individualmente: uma taxa no momento da entrada (que varia conforme o carro esteja em *ativação* ou *desmobilização*) mais uma diária de custódia por dia de permanência, com sete dias de carência para o cliente. A fonte de verdade é a tabela `vehicle_service_charges` — uma linha por cobrança.

**Unidas — guarda de veículos (só SSA).** Não há cobrança por veículo. A conta é feita sobre a **ocupação diária agregada** do pátio: um piso mensal que cobre 50 carros/dia e um valor por carro-dia excedente. A fonte de verdade é a tabela `daily_occupancy` — um snapshot por dia, pátio e cliente.

Em Salvador, o pátio físico é alugado da **Refran**, que cobra pela ocupação total (Stellantis + Unidas somados). A diferença entre o que a Unidas paga e o que a Refran cobra é a **margem da guarda**.

## Quem usa

| Perfil | Quem | Onde |
|---|---|---|
| Operador de pátio | Bira (AZPark) — SSA<br>Diego (Via Total) — REC<br>Marcos (Via Total RN) — NAT | PWA `app.fleetflow.digital` |
| Administração | Chico | Dashboard `dash.fleetflow.digital` + SQL/assistente |
| Cliente Unidas | Equipe Unidas | Portal `unidas.fleetflow.digital` |
| Fornecedor Refran | Equipe Refran | Portal `refran.fleetflow.digital` |

Os operadores são prestadores terceirizados. **Nenhuma tela mostrada a eles exibe valores em R$** — nem o que o cliente paga, nem o que o parceiro recebe. Ver [regras de negócio](04-regras-de-negocio.md#o-que-nunca-fazer).

## As peças do sistema

| Peça | O que é | Onde roda |
|---|---|---|
| **Pátio PWA** | App instalável dos operadores. Foto → OCR de placa por IA → confirmação → gravação | Vercel (Next.js 14) |
| **Banco** | Postgres com todo o estado: veículos, cobranças, ocupação, contratos | Supabase (`sa-east-1`) |
| **Dashboard interno** | KPIs, medição mensal com export, seção Unidas × Refran, assistente de IA | GitHub Pages (HTML único) |
| **Assistente de IA** | Chat que responde perguntas e monta relatórios consultando o banco em modo leitura | Rota `/api/ask` dentro do PWA |
| **Pipeline Vexsoft** | Robô horário que lê vistorias no Gmail, abre o PDF e lança o movimento | Tarefa agendada externa |
| **Portais externos** | Duas páginas estáticas de prestação de contas, uma para a Unidas e outra para a Refran | Vercel + Edge Functions |
| **Cron de diárias** | Job diário que lança as diárias e recalcula os snapshots de ocupação | `pg_cron` no Supabase |

## O ciclo de vida de um veículo

```
                 ┌──────────────────────────────────────────────┐
                 │  Entrada registrada                          │
   chegada  ───▶ │  (PWA pelo operador  OU  vistoria Vexsoft)    │
                 │  → vehicles.status = 'patio'                  │
                 │  → charge de taxa + 1ª diária (só Stellantis) │
                 └──────────────────┬───────────────────────────┘
                                    │
                     todo dia 07:05 │ cron launch_daily_charges
                                    │ → 1 charge de diária por veículo
                                    │ → snapshot em daily_occupancy
                                    ▼
                 ┌──────────────────────────────────────────────┐
                 │  Saída registrada                            │
   retirada ───▶ │  → withdrawal_date preenchido                 │
                 │  → vehicles.status = 'finalizado'             │
                 │  → NENHUMA cobrança nova                      │
                 └──────────────────────────────────────────────┘
```

Duas coisas que costumam confundir quem chega agora:

**"Ativação" e "desmobilização" descrevem o carro, não o movimento.** Ativação é um 0 km entrando na frota; desmobilização é um usado saindo dela. Os dois passam pelo pátio e os dois têm uma entrada e uma saída. O que define a taxa é o *tipo do carro*, cobrado no momento da *entrada*.

**A saída nunca gera cobrança.** Ela só fecha o ciclo. Quem cobra a permanência é o cron, dia a dia, enquanto o veículo estiver com `status = 'patio'`.

## Números da operação (14/08/2026)

- 188 veículos cadastrados — 42 em pátio, 145 finalizados, 1 arquivado
- 3.527 cobranças lançadas — R$ 42.170 de receita bruta acumulada contra R$ 29.630 de custo de parceiro
- Distribuição por pátio: SSA 112, REC 70, NAT 6
- Medição fechada abril–julho/2026: **R$ 27.158**
- Contratos Unidas e Refran vigentes desde 27/07/2026
