# 2. Banco de dados

Postgres no Supabase, projeto `sqbjxabftqtzdigjhivl`. Todas as tabelas de negócio têm RLS habilitado com política ampla para `authenticated` (os frontes autenticam; os portais externos passam por Edge Functions).

## Tabelas principais

### vehicles
Um registro por veículo (placa é **UNIQUE global**). Campos-chave:

| Campo | Significado |
|---|---|
| `client_id` | FK para `profiles` — Stellantis `167748aa-…bf7c` ou Unidas `fea28c45-…b120` |
| `plate` | Placa Mercosul (LLLNLNN). Correções de OCR ficam anotadas em `notes` |
| `status` | `patio` (no pátio hoje) · `finalizado` (saiu) · `archived` |
| `yard` | `SSA` / `REC` / `NAT` |
| `estimated_arrival_date` | **Data de entrada** no pátio |
| `withdrawal_date` | **Data de saída** |
| `notes` | Trilha textual: tipo (ATIVACAO/DESMOBILIZACAO/GUARDA UNIDAS), operador, correções datadas |

### vehicle_service_charges
Cobranças por veículo (só Stellantis). Uma linha por taxa e **uma linha por diária/dia**:
`service_key` ∈ `ativacao` (190/123,50) · `desmobilizacao` (88/57,20) · `diaria` (10/6,50 — `client_charge` 0 quando `grace_applied`). `charge_date` é o dia da diária; `entry_date` a entrada que a originou.

### service_pricing
Tabela de preços vigentes (client_price / partner_price por `service_key`).

### daily_occupancy
Snapshot diário `(occ_date, yard, client_id) → vehicles_count`. Base da medição por ocupação (Unidas e Refran). Recalculado pelos últimos 7 dias a cada rodada do cron para absorver lançamentos retroativos.

### supply_contracts
Contratos de piso/excedente: `unidas_ssa` (mín. 50 carros/dia, R$ 6/diária, piso R$ 9.000/mês) e `refran_ssa` (50 vagas por R$ 3.500/mês + R$ 4 por vaga-dia excedente, contando Stellantis+Unidas em SSA). Vigência a partir de 27/07/2026.

### vexsoft_ingest
Log idempotente do robô Vexsoft. `gmail_message_id` UNIQUE garante que nenhum e-mail é processado duas vezes. `acao` ∈ `entrada_criada` · `saida_lancada` · `duplicado_pwa` · `aguardando_entrada_pwa` · `excecao`.

### entradas_pendentes
Saídas de ativação sem entrada no PWA. O INSERT dispara (trigger + `pg_net`) o push para o encarregado; a tela `/home/pendencias` resolve criando o veículo completo com cobranças.

### audits / audit_items
Auditoria física semanal. `audits` (praça, semana, status) e `audit_items` (uma linha por veículo em pátio no momento da criação; `status` ∈ `pendente` · `fotografado` · `nao_encontrado`; `photo_path` aponta para o bucket `auditorias`).

### push_subscriptions
Inscrições de web push dos PWAs (endpoint UNIQUE, payload da subscription em JSONB).

### profiles / clients / partners
`profiles` guarda pessoas e empresas; `clients` e `partners` são **views** sobre `profiles` (FKs devem referenciar `profiles(id)`).

## Funções e agendamentos no banco

| Objeto | O quê |
|---|---|
| `launch_daily_charges()` | Cron diário **07:05 America/Bahia** (10:05 UTC): lança as diárias do dia para Stellantis (com carência) e refaz o snapshot de `daily_occupancy` dos últimos 7 dias |
| `exec_readonly_sql(q)` | Executor SELECT-only usado pelo chat IA (bloqueia DML/DDL, timeout 10 s, transação read-only; EXECUTE só para `service_role`) |
| `notify_entrada_pendente()` / `notify_audit()` | Triggers AFTER INSERT que chamam as Edge Functions de push via `pg_net` |

## Regras de contagem (fundamentais)

1. **Dia de entrada e dia de saída contam** como diária.
2. **Carência Stellantis**: diárias com `(dia − entrada) ≤ 7` têm `client_charge = 0` (custo do parceiro corre desde o dia 1).
3. **Unidas não tem cobrança por carro** — fatura pela ocupação diária agregada (piso 50).
4. A **1ª diária** é lançada na entrada (client 0, `grace_applied = true`); as demais pelo cron das 7h.

## Storage

Buckets: `evidencias` (fotos das movimentações do PWA), `auditorias` (fotos da auditoria semanal — leitura pública, escrita autenticada).
