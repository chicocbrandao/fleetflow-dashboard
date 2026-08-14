# 03 — Banco de dados

Projeto Supabase `sqbjxabftqtzdigjhivl` (`fleetflow-teste` — **é produção**), região `sa-east-1`.
Extensões relevantes: `pg_cron 1.6.4`, `pg_net 0.20.0`, `pgcrypto`, `pg_stat_statements`.

O schema `public` tem 33 tabelas, mas **apenas 10 fazem parte do FleetFlow**. O resto é herança do projeto ProLine (ver [legado](#tabelas-legadas)). Há ainda um schema `fitwellness`, de outro produto, que não tem relação com o pátio.

---

## As tabelas que importam

### `vehicles` — um registro por ciclo de veículo

188 linhas. É o centro do modelo.

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid NOT NULL | FK → `profiles(id)`. Stellantis ou Unidas |
| `plate` | varchar NOT NULL | **UNIQUE global** — ver limitação abaixo |
| `model`, `brand` | text NOT NULL | |
| `year` | int NOT NULL | o PWA grava o ano corrente quando não sabe |
| `chassi` | varchar NOT NULL UNIQUE | placeholder `PENDING-{placa}` quando não há dado |
| `status` | text | `patio` · `finalizado` · `archived` (texto livre, sem CHECK; default herdado é `'active'`) |
| `estimated_arrival_date` | date | **data de entrada no pátio** |
| `withdrawal_date` | timestamptz | **data de saída** |
| `yard` | text | `SSA` · `REC` · `NAT`. Existe desde 24/07/2026 |
| `notes` | text | trilha textual do movimento (ver formato abaixo) |
| *(demais)* | | `color`, `renavam`, `km`, `fuel_type`, `photos`, `preparacao`, `comercializacao`… herdadas do ProLine, pouco usadas |

**Índices:** só PK, `plate` e `chassi`. Não há índice em `client_id`, `yard` nem `status`.

**Formato de `notes`:** `{TIPO} {MOVIMENTO} - {PRAÇA} ({Operador} {Empresa})`, por exemplo
`ATIVACAO ENTRADA - SSA (Bira AZPark)`. Na entrada o campo é **sobrescrito**; na saída o texto novo é **concatenado** com ` | `.

**Como descobrir o tipo do carro a partir de `notes`:** vale a palavra `ATIVACAO`/`DESMOBILIZACAO` que aparecer **primeiro**, porque o primeiro segmento é sempre a entrada — e é a entrada que define a taxa cobrada. `ENTRADA`/`SAIDA` são o eixo do movimento e só servem de fallback para registros legados.

**Duas limitações do modelo que já causaram problema:**

1. `plate` é UNIQUE global, então **o banco não representa a reentrada do mesmo carro**. Um veículo que passa duas vezes pelo pátio não pode ter dois registros. Caso real: TVH8D65 / TYH8D65.
2. `withdrawal_date` é `timestamptz` gravado à meia-noite UTC. Aplicar `at time zone 'America/Sao_Paulo'` **volta um dia** (mostra 21:00 do dia anterior). **O valor cru é o correto** — use `withdrawal_date::date` sem conversão.

### `vehicle_service_charges` — a fonte de verdade financeira

3.527 linhas. Uma linha por cobrança.

| Coluna | Tipo | Observação |
|---|---|---|
| `vehicle_id` | uuid NOT NULL | FK → `vehicles` |
| `service_key` | text NOT NULL | `ativacao` · `desmobilizacao` · `diaria` · `remocao_plotagem` · `reset_luz_painel` · `troca_vidro_triangular` |
| `client_charge` | numeric NOT NULL | o que a Stellantis paga |
| `partner_cost` | numeric NOT NULL | o que o pátio recebe |
| `margin` | numeric | **coluna gerada**: `client_charge - partner_cost` |
| `charge_date` | date | dia a que a cobrança se refere |
| `entry_date` | date | data de entrada do veículo (nas diárias) |
| `days_count` | int | sempre 1 no modelo atual |
| `grace_applied` | bool | `true` quando o dia caiu na carência |
| `status` | text | `pending` (2.363) · `cancelled` (1.164) |
| `pricing_id` | uuid | FK → `service_pricing` |
| `notes` | text | rastro do lançamento |

**Regra de ouro:** todo somatório de faturamento precisa filtrar `status <> 'cancelled'`. Um terço das linhas está cancelada — resultado das conciliações de julho e agosto.

**Não existe constraint UNIQUE** de `(vehicle_id, service_key, charge_date)`. A idempotência das diárias depende exclusivamente do `NOT EXISTS` dentro de `launch_daily_charges()`. Qualquer código novo que insira diárias precisa repetir essa checagem.

Distribuição: `diaria` 3.455, `desmobilizacao` 45, `ativacao` 23, extras 4. Período coberto: 01/04/2026 a 14/08/2026.

### `daily_occupancy` — snapshot de ocupação

111 linhas. Uma linha por `(dia, pátio, cliente)`, com `UNIQUE (occ_date, yard, client_id)` — o alvo do `ON CONFLICT` do cron.

| Coluna | Observação |
|---|---|
| `occ_date` | dia do snapshot |
| `yard` | pátio |
| `client_id` | Stellantis ou Unidas |
| `car_count` | veículos naquele dia |
| `computed_at` | quando o cron calculou |

É a base **exclusiva** da cobrança Unidas e do repasse Refran. Cobre de 01/07/2026 em diante.

### `supply_contracts` — contratos de ocupação

2 linhas. Parametriza os cálculos de ocupação sem hardcode.

| `code` | `kind` | contraparte | pátio | inclui | mensal | excedente | início |
|---|---|---|---|---|---|---|---|
| `unidas_ssa` | client | Unidas | SSA | 50 carros | R$ 9.000 | R$ 6,00/carro-dia | 27/07/2026 |
| `refran_ssa` | supplier | Refran | SSA | 50 vagas | R$ 3.500 | R$ 4,00/carro-dia | 27/07/2026 |

### `service_pricing` — tabela de preços

7 linhas. **Nunca hardcode preço**: leia daqui.

| `service_key` | cliente | parceiro | carência cliente | extra? |
|---|---|---|---|---|
| `ativacao` | 190,00 | 123,50 | 0 | não |
| `desmobilizacao` | 88,00 | 57,20 | 0 | não |
| `diaria` | 10,00 | 6,50 | **7 dias** | não |
| `diaria_unidas` | 6,00 | 0,00 | 0 | não |
| `remocao_plotagem` | 350,00 | 50,00 | 0 | **sim** |
| `reset_luz_painel` | 250,00 | 100,00 | 0 | **sim** |
| `troca_vidro_triangular` | 2.500,00 | 1.500,00 | 0 | **sim** |

`UNIQUE (service_key, client_id, partner_id)` permite preço global (com os dois nulos) e preço específico por cliente — é assim que `diaria_unidas` coexiste com `diaria`.

### `vehicle_history` — auditoria de movimentação

99 linhas. `action` segue o padrão `{tipo}_{movimento}`: `ativacao_entrada`, `desmobilizacao_saida`, `guarda_entrada`, `guarda_saida`, mais `undo` para lançamentos desfeitos. `performed_by` guarda o `auth.uid()` do operador (sem FK).

### `vexsoft_ingest` — log da ingestão automática

Uma linha por e-mail de vistoria processado. `gmail_message_id` é UNIQUE — é o que garante idempotência do pipeline. O campo `acao` registra a decisão tomada: `entrada_criada`, `saida_lancada`, `duplicado_pwa` ou `excecao`.

### `entradas_pendentes` — fila de exceção

Alimentada pelo pipeline quando uma **saída** é detectada por vistoria mas o veículo nunca teve entrada registrada. O operador resolve pela tela de pendências do PWA informando a data de entrada. Tem um trigger `AFTER INSERT` que dispara push notification.

### `profiles` — usuários

12 linhas, espelha `auth.users`. Enum `user_role`: `client`, `specialist`, `supplier`, `admin`, `finance`, `operator`. A coluna `yard` (com CHECK em `SSA|REC|NAT`) é o que amarra cada operador ao seu pátio.

Contém também os dois "clientes": **Stellantis** (`167748aa-2fee-49df-9b0f-140919bfbf7c`) e **Unidas** (`fea28c45-8ca5-4550-98ad-3f9e78b7a120`) — esses UUIDs aparecem hardcoded em vários pontos do código.

### `push_subscriptions`

Assinaturas Web Push dos operadores. **Hoje está vazia**, o que significa que a notificação de pendência não chega a ninguém — ver [pendências](10-pendencias-e-riscos.md).

---

## Funções

| Função | Segurança | O que faz |
|---|---|---|
| `launch_daily_charges()` | DEFINER | Job diário: lança diárias e recalcula snapshots |
| `ai_read_sql(q text)` | INVOKER | Gateway SQL somente-leitura do assistente |
| `calculate_parking_charges(...)` | INVOKER | Cálculo avulso de diárias de um veículo (pouco usado) |
| `notify_entrada_pendente()` | DEFINER | Trigger → chama a Edge Function de push |
| `get_users_count`, `get_pending_users`, `get_clients_with_vehicle_count`, `get_unread_notifications_count`, `get_pending_checklist_reviews[_count]` | DEFINER | **Legado ProLine**, não usadas pelo pátio |

### `launch_daily_charges()` — o coração da cobrança

Roda em `America/Bahia`. Três etapas:

1. Lê o preço de `diaria` em `service_pricing`. Se não achar, aborta com `{"ok": false}`.
2. **Insere uma diária por veículo**, mas **só para a Stellantis** (o `client_id` está hardcoded na função). Critério: `status = 'patio'` e `estimated_arrival_date <= hoje`. Um `NOT EXISTS` por `(vehicle_id, service_key='diaria', charge_date)` evita duplicar. Cobra R$ 0 do cliente durante a carência de 7 dias e o preço cheio depois; o custo do parceiro é lançado desde o dia 1.
3. **Recalcula os snapshots de ocupação numa janela de 7 dias** (`hoje-6` até `hoje`), com `INSERT … ON CONFLICT DO UPDATE`, e em seguida **deleta** as linhas de `daily_occupancy` daquele dia que não têm mais veículo correspondente — porque um upsert sozinho nunca zeraria uma contagem.

A janela de 7 dias é o que faz lançamentos retroativos recentes se autocorrigirem. Retroativos com mais de 7 dias exigem recálculo manual.

### `ai_read_sql(q text)` — o gateway do assistente

Barreiras, em ordem:

1. Rejeita qualquer consulta que não comece com `SELECT` ou `WITH`.
2. Rejeita mais de um comando (qualquer `;` interno).
3. `SET LOCAL ROLE ff_ai_readonly` — **a garantia real**: um papel sem nenhum privilégio de escrita, sem `USAGE` em `auth`, `storage`, `cron` ou `vault`, e sem `BYPASSRLS`.
4. `SET LOCAL statement_timeout = '20s'`.
5. Envelopa a consulta em `select * from (<q>) _q limit 2000` — o que, de quebra, faz o Postgres recusar CTEs que modificam dados ("*data-modifying statement must be at the top level*").
6. `RESET ROLE` no sucesso e no erro.

O `EXECUTE` foi revogado de `anon` e `authenticated`; só `service_role` chama.

---

## Agendamento

Um único job de `pg_cron`:

| jobid | nome | schedule | comando |
|---|---|---|---|
| 2 | `launch-daily-charges` | `5 10 * * *` (UTC) = **07:05 America/Bahia** | `SELECT public.launch_daily_charges();` |

Histórico contínuo e sem falhas, duração típica de 0,15 a 0,35 s.

> Documentos antigos citam 03:05 UTC. **O valor correto é `5 10 * * *`** — o horário foi mudado em julho/2026 para casar com a regra "todo dia às 7h" dos contratos de ocupação.

## Edge Functions

| Função | Criada | O que faz |
|---|---|---|
| `dashboard-unidas` | 24/07/2026 | Alimenta o portal da Unidas: contrato, carros no pátio agora, série diária do mês, excedentes e fatura parcial |
| `dashboard-refran` | 24/07/2026 | Alimenta o portal da Refran: ocupação **total** do pátio SSA (todos os clientes) e repasse. Não expõe placas, clientes nem receita |
| `notify-entrada-pendente` | 13/08/2026 | Recebe o POST do trigger e dispara Web Push para todas as assinaturas; remove assinaturas mortas (404/410) |

Todas com `verify_jwt: true` — a chamada precisa levar a chave anônima no header, e o controle de acesso real é o token na query string.

## Storage

| Bucket | Público | Objetos | Uso |
|---|---|---|---|
| `patio-evidence` | **não** | 128 (71 MB) | Fotos das movimentações. Path `{yard}/{yyyy-mm-dd}/{uuid}.jpg` |
| `evidencias` | sim | 3 (14 MB) | Legado ProLine |
| `medicoes-tmp` | sim | 0 | Temporário de medição |

Policies do `patio-evidence`: o operador só consegue subir na pasta do próprio pátio (validado contra `profiles.yard`); a leitura é liberada para qualquer autenticado, porque a server action precisa baixar a imagem para mandar ao modelo de visão.

## RLS

RLS está **habilitado em todas as 33 tabelas**. Três padrões convivem:

- **ProLine:** `Admin full access` (tudo, para `role='admin'`) + leitura livre para `authenticated`.
- **Pátio:** policies específicas por papel — `operator` lê e insere veículos, `operator|admin` atualiza, `operator|admin` insere cobranças. Não há policy de UPDATE nem DELETE em `vehicle_service_charges` (correções passam por SQL administrativo).
- **Assistente:** `ff_ai_readonly_select` em toda tabela, apenas SELECT, apenas para o papel `ff_ai_readonly`.

**Quatro tabelas são legíveis pela chave anônima, sem login:** `vehicles` (incluindo placa e chassi), `daily_occupancy`, `supply_contracts` (valores de contrato) e `vexsoft_ingest`. É o que permite o dashboard funcionar como HTML estático — e é também um risco documentado em [10](10-pendencias-e-riscos.md).

## Papéis

O único papel customizado é **`ff_ai_readonly`**: sem login, sem `BYPASSRLS`, com `USAGE` apenas em `public` e `SELECT` nas tabelas. Tudo o mais é padrão do Supabase.

## Tabelas legadas

Vazias e sem uso pelo pátio, todas herdadas do **ProLine** — um produto anterior de gestão de serviços automotivos que usou o mesmo banco:

`addresses`, `audit_logs`, `collection_requests`, `invoices`, `mechanics_checklist`, `mechanics_checklist_items`, `mechanics_checklist_evidences`, `notifications`, `part_requests`, `partner_services`, `partners_service_categories`, `parts_inventory`, `payment_transactions`, `quote_admin_approvals`, `quote_items`, `reports`, `service_pricing_history`, `services`, `supplier_fees`, `supplier_price_tables`.

Duas ainda têm dados residuais: `service_orders` (65) e `quotes` (55). E `clients` / `partners` **não são tabelas** — são views sobre `profiles` filtrando por `role`.

## Migrations aplicadas

| Versão | Nome |
|---|---|
| 20250311120000 | `init_schema` (base ProLine) |
| 20260520180717 | `allow_anon_vehicle_insert_update` |
| 20260525145050 | `add_operator_role_and_yard_column` |
| 20260525145103 | `add_yard_column_to_profiles` |
| 20260525155832 | `enable_rls_operator_policies` |
| 20260525155935 | `create_desmobilize_vehicle_rpc` |
| 20260525161022 | `harden_desmobilize_vehicle_search_path` |
| 20260525161147 | `remove_bot_neo_anon_policies` |
| 20260525185240 | `drop_recursive_admin_profiles_policy` |
| 20260525193942 | `drop_old_desmobilize_rpc` |
| 20260525194005 | `create_launch_daily_charges_and_cron` |
| 20260525230425 | `vehicle_history_insert_policy` |
| 20260611113208 | `fitwellness_init` |
| 20260724144446 | `unidas_refran_phase1` |
| 20260729015116 | `occupancy_trailing_window` |
| 20260813142035 | `vexsoft_ingest_pipeline` |
| 20260814151155 | `entradas_pendentes_push` |
| 20260814174103 | `ai_readonly_role_and_policies` |
| 20260814174127 | `ai_read_sql_function` |
| 20260814174148 | `ai_read_sql_function_v2` |
| 20260814· | `harden_definer_function_grants` |
