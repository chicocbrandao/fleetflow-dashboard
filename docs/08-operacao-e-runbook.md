# 08 — Operação e runbook

## Deploy

### Dashboard (este repositório)

```bash
cd ~/projetos/fleetflow-dashboard
# edite index.html ou docs/
git add -A && git commit -m "..." && git push origin main
```
O GitHub Pages publica em cerca de 2 minutos. O domínio customizado está fixado via API do GitHub (o arquivo `CNAME` sozinho não bastou).

### Pátio PWA

```bash
cd ~/Desktop/"FLeet Flow"/patio-pwa
npx vercel deploy --prod
```
Não há Git nem CI. O build acontece na Vercel, o que também contorna arquivos "placeholder" do iCloud. Variáveis de ambiente pelo painel da Vercel (Production **e** Preview).

### Portais Unidas / Refran

```bash
cd ~/Desktop/"FLeet Flow"/fleetflow-unidas   # ou fleetflow-refran
npx vercel deploy --prod
```
Lembre-se: existe uma cópia idêntica em `patio-pwa/public/`. Alterou uma, atualize a outra.

### Banco

Migrations pelo MCP do Supabase ou pelo painel. As migrations do PWA ficam versionadas em `patio-pwa/supabase/migrations/`.

---

## Monitoramento

### O cron rodou?

```sql
select jobid, status, start_time, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'launch-daily-charges')
order by start_time desc
limit 10;
```
Esperado: `succeeded`, uma execução por dia às 10:05 UTC, duração abaixo de 1 s.

### As diárias de hoje foram lançadas?

```sql
select count(*), sum(client_charge)
from vehicle_service_charges
where service_key = 'diaria'
  and charge_date = (now() at time zone 'America/Bahia')::date
  and status <> 'cancelled';
```
O número deve bater com a quantidade de veículos Stellantis em pátio.

### O pipeline Vexsoft está processando?

```sql
select acao, count(*), max(created_at)
from vexsoft_ingest
group by acao
order by 2 desc;
```
Preste atenção nas linhas com `acao = 'excecao'` — cada uma precisa de decisão humana.

### Tem pendência aberta?

```sql
select plate, yard, saida_date, created_at
from entradas_pendentes
where status = 'pendente'
order by created_at;
```

### Ocupação de hoje (ao vivo, não o snapshot)

```sql
select coalesce(yard, '?') as patio,
       count(*) filter (where client_id = '167748aa-2fee-49df-9b0f-140919bfbf7c') as stellantis,
       count(*) filter (where client_id = 'fea28c45-8ca5-4550-98ad-3f9e78b7a120') as unidas,
       count(*) as total
from vehicles
where status = 'patio'
group by 1 order by 4 desc;
```

---

## Rotinas automáticas (visão consolidada)

| Quando | O quê | Onde conferir |
|---|---|---|
| Diário 07:05 (Bahia) | `launch_daily_charges()` — diárias Stellantis + snapshot de ocupação (janela de 7 dias) | `vehicle_service_charges` / `daily_occupancy` |
| A cada hora (min 35) | Robô Vexsoft (**Mac mini**, launchd `br.fleetflow.robo-vexsoft`) processa e-mails de vistoria | `vexsoft_ingest` / `robos/logs/robo_vexsoft.log` |
| Segunda 08:00 (Bahia) | Robô de auditoria (**Mac mini**, launchd `br.fleetflow.robo-auditoria`) cria `audits`/`audit_items` por praça e o trigger dispara push aos PWAs (`push-broadcast`) | `audits` / `audit_items` / fotos no bucket `auditorias` |

Os dois robôs rodam no **Mac mini** (`macmini-server`) desde 19/08/2026, no usuário `agent`, em `/Users/agent/fleetflow/robos/` (acesso: `ssh mini`; cópia dos scripts também em `Desktop/FLeet Flow/robos/` no MacBook). O mini já é servidor 24/7 (`pmset sleep 0`). As tarefas agendadas equivalentes na nuvem ficam ativas em paralelo até ~26/08/2026 e depois serão desativadas.

### Alerta se um robô parar (watchdog)

Cada rodada bem-sucedida atualiza um **sinal de vida** na tabela `heartbeats`. Dois vigias independentes do Mac mini conferem esse sinal:

| Vigia | Onde roda | Frequência | Dispara quando | Alerta por |
|---|---|---|---|---|
| `check_robot_heartbeats()` | `pg_cron` no Supabase | a cada 30 min | Vexsoft >2h30 sem rodar; auditoria >7d6h | web push aos PWAs (`push-broadcast`), no máx. 1 a cada 6h |
| Vigia diário | Tarefa agendada na nuvem, 09:00 (Bahia) | 1×/dia | robô parado, >3 exceções em 24h ou pendência de entrada >48h | notificação push do app Claude no celular do gestor |

Para receber o web push do primeiro vigia é preciso ter tocado em "🔔 Ativar notificações" no PWA (tabela `push_subscriptions`). O segundo vigia não depende disso.

### Auditoria física semanal

Criada em 19/08. O operador recebe o push na segunda, abre `/home/auditoria` e fotografa carro a carro (ou marca "Não está"). Acompanhamento do gestor:

```sql
-- progresso da semana
select a.yard, a.status, a.total_items,
       count(*) filter (where i.status='fotografado') as fotografados,
       count(*) filter (where i.status='nao_encontrado') as nao_encontrados
from audits a join audit_items i on i.audit_id = a.id
where a.week_start = date_trunc('week', current_date)::date
group by 1,2,3;
-- divergências (carro no sistema que não está no pátio)
select a.yard, i.plate, i.model from audit_items i
join audits a on a.id = i.audit_id
where i.status = 'nao_encontrado' order by a.week_start desc;
```

Um `nao_encontrado` é o gatilho para investigar saída não registrada (mesmo playbook das conciliações do capítulo 09).

### Conferência de pátio (impressão)

Dashboard → seção "Veículos em Pátio" → botões **XLSX**/**PDF** (a coluna "Conferido ✓" sai em branco para marcar no papel). O mesmo existe no PWA em `/home/patio`.

## Tarefas comuns

### Fechar a medição do mês (Stellantis)

```sql
select coalesce(v.yard, '?') as patio,
       count(distinct v.id)             as veiculos,
       sum(c.client_charge)             as receita,
       sum(c.partner_cost)              as custo,
       sum(c.client_charge - c.partner_cost) as margem
from vehicle_service_charges c
join vehicles v on v.id = c.vehicle_id
where c.charge_date >= date '2026-08-01'
  and c.charge_date <  date '2026-09-01'
  and c.status <> 'cancelled'
  and v.status <> 'archived'
  and v.client_id = '167748aa-2fee-49df-9b0f-140919bfbf7c'
group by 1 order by 3 desc;
```
Ou, mais simples: peça ao assistente do dashboard e baixe em Excel.

### Fatura da Unidas no mês

```sql
with c as (select * from supply_contracts where code = 'unidas_ssa')
select c.base_monthly
     + coalesce(sum(greatest(0, o.car_count - c.included_units)), 0) * c.excess_rate as fatura,
       coalesce(sum(greatest(0, o.car_count - c.included_units)), 0) as carro_dias_excedentes
from c
left join daily_occupancy o
  on o.yard = 'SSA' and o.client_id = c.client_id
 and o.occ_date >= greatest(date '2026-08-01', c.starts_on)
 and o.occ_date <  date '2026-09-01'
group by c.base_monthly, c.excess_rate;
```

### Lançar um extra

**Sempre confira a placa primeiro** — ver [regra 3](04-regras-de-negocio.md#3-conferir-a-placa-antes-de-lançar-um-extra).

```sql
-- 1. achar o veículo
select id, plate, status, yard from vehicles where plate = 'ABC1D23';

-- 2. só depois de confirmado o id:
insert into vehicle_service_charges
  (vehicle_id, pricing_id, service_key, client_charge, partner_cost,
   charge_date, days_count, grace_applied, status, client_id, notes)
select :vehicle_id, p.id, p.service_key, p.client_price, p.partner_price,
       current_date, 1, false, 'pending', v.client_id, 'Extra lançado pelo admin'
from service_pricing p, vehicles v
where p.service_key = 'remocao_plotagem' and p.is_active
  and v.id = :vehicle_id;
```

### Corrigir uma data de saída

```sql
update vehicles
   set withdrawal_date = date '2026-07-22',
       status = 'finalizado'
 where plate = 'ABC1D23';

-- e cancelar as diárias posteriores à saída real
update vehicle_service_charges
   set status = 'cancelled',
       notes = coalesce(notes,'') || ' | CANCELADA: pós-saída real'
 where vehicle_id = (select id from vehicles where plate = 'ABC1D23')
   and service_key = 'diaria'
   and charge_date > date '2026-07-22'
   and status <> 'cancelled';
```

### Criar um operador novo

Edite `scripts/create-operators.mjs` com o e-mail e o pátio e rode `node scripts/create-operators.mjs`. O script é idempotente e imprime a senha temporária.

### Pausar ou reagendar o cron

```sql
select cron.alter_job(2, schedule := '5 10 * * *');   -- reagendar
update cron.job set active = false where jobid = 2;   -- pausar
```

---

## Troubleshooting

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Export PDF do dashboard não faz nada | CDN do jsPDF fora do ar ou versão removida | Trocar a URL do script (já aconteceu com o cdnjs em 11/08) |
| Assistente responde "Acesso negado" | Senha errada, ou sessão sem `ff_pw` | Recarregar a página e entrar de novo |
| Assistente dá erro de CORS | Origem não está na lista da rota `/api/ask` | Adicionar o domínio em `ALLOWED_ORIGINS` |
| Assistente devolve 307 / cai no login | `/api/ask` fora da lista de rotas públicas do middleware | Conferir `lib/supabase/middleware.ts` |
| Loop infinito de login no PWA | Cookies perdidos no redirect do middleware | `createRedirectWithCookies()` precisa copiar os cookies |
| Diárias duplicadas em um dia | Alguém inseriu diária fora do cron | Não existe UNIQUE no banco: cancelar as duplicadas à mão |
| Dashboard mostra menos carros que o real | Lançamento retroativo fora da janela de 7 dias do snapshot | Recalcular `daily_occupancy` do período |
| Saída aparece um dia adiantada | Conversão de fuso em `withdrawal_date` | Usar `withdrawal_date::date` sem `at time zone` |
| OCR erra a placa | Foto ruim ou caractere ambíguo | O operador corrige na tela de revisão; a confiança "baixa" é o alerta |
| Veículo não encontrado na saída | Cliente errado no seletor (Stellantis × Unidas) | Conferir o toggle; a busca filtra por cliente |
| Push não chega | `push_subscriptions` está vazia | Operador precisa aceitar a notificação no PWA instalado |
| Robô Vexsoft não roda no horário | Mac mini fora do ar, ou agente descarregado | `ssh mini 'tail -20 fleetflow/robos/logs/robo_vexsoft.log; launchctl list \| grep fleetflow'`; recarregar com `launchctl unload && load` do plist em `~/Library/LaunchAgents/` |
| Robô Vexsoft: erro de login no Gmail | Senha de app revogada/trocada | Criar nova senha de app na conta `chico@clampatrimonial.com.br` e atualizar `GMAIL_APP_PASSWORD` em `/Users/agent/fleetflow/robos/.env` no mini |
| Robô lança tudo como exceção | Vexsoft mudou o formato do e-mail/PDF | Ajustar regexes em `robos/robo_vexsoft.py` (`parse_email`/`read_pdf`) |

## Gotchas do ambiente local

- A pasta `FLeet Flow` está no **iCloud**. Arquivos podem estar como *placeholder* e quebrar builds locais — materialize com `cat` antes, ou deixe a Vercel buildar remotamente.
- O `patio-pwa` **não é um repositório Git**. Não existe histórico nem backup fora da Vercel.
- Nunca recrie policies de RLS recursivas em `profiles`. A policy `Admins can view all profiles` custou quatro horas de depuração e foi removida.
