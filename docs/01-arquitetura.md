# 1. Arquitetura

## Visão geral

O FleetFlow é composto por um banco central (Supabase/Postgres), quatro frontes web e dois robôs de automação. Todo o estado do negócio vive no banco; os frontes leem/escrevem via API do Supabase e os robôs operam por tarefas agendadas.

**Fluxo:** e-mails de vistoria (Vexsoft) → Robô de ingestão (hora em hora) → Supabase ← PWA dos encarregados (entradas de ativação, pendências, auditoria). O Dashboard, o Chat IA e os portais Unidas/Refran leem do mesmo banco. Pushes web (VAPID) avisam os encarregados de pendências e auditorias.

## Peças

**Supabase (projeto `sqbjxabftqtzdigjhivl`)** — Postgres com RLS, Storage (fotos de evidência e auditoria), Edge Functions (Deno) e `pg_cron`/`pg_net`. É a única fonte de verdade.

**PWA operacional** (`patio-pwa`, Next.js App Router, deploy Vercel) — usado pelos encarregados no celular. Registra entradas/saídas com foto e OCR de placa (Claude Vision), resolve pendências de ativação, confere o pátio e executa a auditoria fotográfica semanal. Recebe web push (VAPID).

**Dashboard interno** (`fleetflow-dashboard`, página estática única, GitHub Pages) — visão gerencial: KPIs, veículos em pátio (com exportação XLSX/PDF), medição mensal, seção Unidas × Refran e chat com IA que consulta o banco.

**Portais externos** — páginas somente-leitura com token na URL para o cliente Unidas e o fornecedor Refran acompanharem ocupação e fatura estimada. Servidas por Edge Functions (`dashboard-unidas`, `dashboard-refran`).

**Robô Vexsoft** — tarefa agendada de hora em hora (Claude Code Remote). Lê os e-mails de comprovante de vistoria do Vexsoft, abre o PDF, e lança entradas/saídas no banco conforme as regras do capítulo 5.

**Robô de Auditoria** — tarefa agendada semanal que fotografa a posição do pátio em `audits`/`audit_items` e dispara push aos encarregados para a conferência física com foto.

## Edge Functions em produção

| Função | Papel |
|---|---|
| `dash-chat` | Chat IA do dashboard: loop agêntico Claude + ferramenta SQL somente-leitura |
| `notify-entrada-pendente` | Web push quando o robô Vexsoft cria uma entrada pendente de ativação |
| `push-broadcast` | Web push genérico (título/corpo/URL) — usado pela auditoria semanal |
| `dashboard-unidas` / `dashboard-refran` | Servem os portais externos com token |

## Domínios

`fleetflow.digital` (Hostinger DNS): `dash` → GitHub Pages; `app`, `unidas`, `refran` → Vercel. O domínio `fleetflow.com.br` (Registro.br/KingHost) aguarda acesso ao DNS para o espelho `dash.fleetflow.com.br`.
