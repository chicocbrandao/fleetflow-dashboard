# 02 — Arquitetura

## Visão em uma tela

```
   OPERADORES                ADMIN                 CLIENTE / FORNECEDOR
   Bira · Diego · Marcos     Chico                 Unidas        Refran
        │                      │                      │             │
        │ celular              │ navegador            │             │
        ▼                      ▼                      ▼             ▼
 ┌──────────────┐      ┌───────────────┐      ┌──────────────┐ ┌──────────────┐
 │  Pátio PWA   │      │  Dashboard    │      │ Portal       │ │ Portal       │
 │ app.fleet…   │      │ dash.fleet…   │      │ unidas.…     │ │ refran.…     │
 │ Next.js 14   │      │ HTML único    │      │ HTML estát.  │ │ HTML estát.  │
 │ Vercel       │      │ GitHub Pages  │      │ Vercel       │ │ Vercel       │
 └──┬────────┬──┘      └───┬───────┬───┘      └──────┬───────┘ └──────┬───────┘
    │        │             │       │                 │                │
    │        │  chat       │       │ leitura direta  │ token ?t=      │ token ?t=
    │        │  x-ff-key   │       │ (anon key)      │                │
    │        └─────────────┘       │                 ▼                ▼
    │                              │        ┌────────────────────────────────┐
    │  server actions              │        │  Edge Functions                │
    │  (service role)              │        │  dashboard-unidas              │
    │                              │        │  dashboard-refran              │
    ▼                              ▼        │  notify-entrada-pendente       │
 ┌───────────────────────────────────────────────────────────────────────────┐
 │                          SUPABASE  (sa-east-1)                            │
 │                                                                           │
 │   Postgres          Auth              Storage           pg_cron           │
 │   ├ vehicles        3 operadores      patio-evidence    launch_daily_     │
 │   ├ vehicle_        + admin           (privado,         charges           │
 │   │  service_       + clientes         evidências)      07:05 BRT         │
 │   │  charges                                                              │
 │   ├ daily_occupancy      funções: ai_read_sql (read-only p/ IA)           │
 │   ├ supply_contracts               launch_daily_charges (SECURITY DEFINER)│
 │   ├ vehicle_history                calculate_parking_charges              │
 │   ├ vexsoft_ingest                                                        │
 │   └ entradas_pendentes                                                    │
 └───────────────────────────────────────────────────────────────────────────┘
                    ▲                                    ▲
                    │                                    │
        ┌───────────┴────────────┐            ┌──────────┴───────────┐
        │  Pipeline Vexsoft      │            │  Anthropic API       │
        │  Mac mini (launchd)    │            │  claude-sonnet-5     │
        │  hora em hora (min 35) │            │  · OCR de placa      │
        │  Gmail → PDF → banco   │            │  · assistente SQL    │
        └────────────────────────┘            └──────────────────────┘
```

## Componentes

### Pátio PWA — `app.fleetflow.digital`

Next.js 14 (App Router) + TypeScript + Tailwind, hospedado na Vercel (projeto `patio-pwa`). É o único componente com backend próprio: usa **server actions** e uma **route handler** (`/api/ask`), e é onde ficam as duas chaves sensíveis do sistema (`ANTHROPIC_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY`). Também serve os portais estáticos em `/unidas` e `/refran` por *rewrite*.

O código-fonte vive **apenas** em `~/Desktop/FLeet Flow/patio-pwa/` e na Vercel — **não é um repositório Git**. Isso é um risco conhecido, registrado em [pendências](10-pendencias-e-riscos.md).

Detalhes em [05 — PWA dos operadores](05-pwa-operadores.md).

### Banco — Supabase `sqbjxabftqtzdigjhivl`

Projeto `fleetflow-teste` (o nome é herança; **é produção**), região `sa-east-1`. Concentra Postgres, Auth, Storage, Edge Functions e o agendador `pg_cron`. Convive no mesmo projeto com o schema `fitwellness` (outro produto) e com tabelas herdadas do projeto **ProLine**, que hoje estão vazias.

Detalhes em [03 — Banco de dados](03-banco-de-dados.md).

### Dashboard interno — `dash.fleetflow.digital`

Um único `index.html` servido pelo GitHub Pages a partir do repositório `chicocbrandao/fleetflow-dashboard`. Carrega Chart.js, SheetJS, jsPDF e o SDK do Supabase por CDN. Lê o banco **diretamente com a chave anônima** (as tabelas relevantes têm policy de leitura para `anon`) e calcula a medição no navegador. O acesso é protegido por uma senha comparada por hash no próprio JavaScript.

Detalhes em [06 — Dashboard e assistente](06-dashboard-e-assistente.md).

### Assistente de IA — `/api/ask`

Rota dentro do PWA que recebe uma pergunta em linguagem natural do dashboard, conversa com o Claude em modo *tool use* e devolve resposta, tabela e gráfico. As consultas passam pela função `ai_read_sql`, que executa sob um papel Postgres **sem nenhum privilégio de escrita**.

### Portais externos

Duas páginas HTML estáticas, uma por contraparte, com projeto Vercel próprio e também publicadas dentro do PWA (`/unidas`, `/refran`). Não falam com o banco: chamam Edge Functions dedicadas que aplicam o recorte de dados de cada uma. O acesso é por **token na query string**.

### Pipeline Vexsoft

Script Python no **Mac mini** (launchd, hora em hora no minuto 35) que lê os e-mails de vistoria da Vexsoft no Gmail (IMAP), abre o PDF, identifica placa/tipo/pátio e lança o movimento no banco. Desde 13/08/2026 é a **entrada principal de dados da Stellantis**; o PWA virou backup para esse cliente. A Unidas continua 100% no PWA.

Detalhes em [07 — Integrações](07-integracoes.md).

## Domínios e DNS

Zona `fleetflow.digital`, gerenciada no **Hostinger**.

| Host | Aponta para | Servido por |
|---|---|---|
| `app.fleetflow.digital` | projeto `patio-pwa` | Vercel |
| `dash.fleetflow.digital` | `chicocbrandao.github.io` | GitHub Pages |
| `unidas.fleetflow.digital` | projeto `fleetflow-unidas` | Vercel |
| `refran.fleetflow.digital` | projeto `fleetflow-refran` | Vercel |

> **`fleetflow.com.br` não está sob nosso controle.** O registro está em nome da Semplice, com nameservers na KingHost (site e e-mail). Sem acesso ao painel, não é possível criar subdomínios nesse domínio.

Uma pegadinha registrada: o arquivo `CNAME` no repositório **não** foi suficiente para o GitHub Pages assumir o domínio customizado — foi preciso forçar via API (`gh api -X PUT repos/.../pages -f cname=...`).

## Onde vive cada segredo

| Segredo | Onde está | Quem usa |
|---|---|---|
| `ANTHROPIC_API_KEY` | Env var da Vercel (projeto `patio-pwa`) | OCR de placa e assistente |
| `SUPABASE_SERVICE_ROLE_KEY` | Env var da Vercel | Assistente (`/api/ask`) |
| Chave anônima do Supabase | Embutida em HTML público (dashboard e portais) | Leitura pelas policies de `anon` |
| Senha do dashboard | Só na cabeça do Chico; o hash está no HTML | Login do dash e do assistente |
| Tokens dos portais | Constantes dentro das Edge Functions | Acesso Unidas/Refran |
| Chaves VAPID (push) | Constantes dentro da Edge Function de push | Notificação de pendência |

O padrão "constante dentro do código" para tokens e VAPID é dívida conhecida — ver [10 — Pendências e riscos](10-pendencias-e-riscos.md).

## Fluxo de dados: de onde vem cada número

| Número | Origem | Calculado onde |
|---|---|---|
| Medição mensal Stellantis | `vehicle_service_charges` | Dashboard (JS) e assistente (SQL) |
| Fatura Unidas | `daily_occupancy` + `supply_contracts` | Edge Function `dashboard-unidas` e dashboard |
| Repasse Refran | `daily_occupancy` (todos os clientes) + `supply_contracts` | Edge Function `dashboard-refran` e dashboard |
| Carros em pátio "hoje" | `vehicles` com `status='patio'` — **ao vivo** | Dashboard |
| Ocupação histórica | `daily_occupancy` — snapshot das 07:05 | Cron |

A distinção da última linha importa: o snapshot **não enxerga** lançamentos feitos depois das 07:05 do dia. Por isso o cron recalcula uma **janela deslizante de 7 dias** a cada execução, corrigindo automaticamente lançamentos retroativos recentes. Além de 7 dias o histórico congela e correções precisam ser feitas à mão.
