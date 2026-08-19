# 05 — Pátio PWA (operadores)

**URL:** `https://app.fleetflow.digital` · **Código:** `~/Desktop/FLeet Flow/patio-pwa/` · **Deploy:** Vercel, projeto `patio-pwa`
**Em produção desde:** 25/05/2026

App instalável (PWA) usado por Bira, Diego e Marcos para registrar movimentações direto do celular, no pátio. Substituiu um bot de Telegram.

## Stack

| | |
|---|---|
| Framework | Next.js **14.2.15** (App Router) + TypeScript strict |
| UI | Tailwind 3.4 — botões e campos grandes, pensados para uso em campo |
| Dados | Supabase (`@supabase/ssr` 0.5, `supabase-js` 2.45) |
| IA | Anthropic SDK 0.32 — modelo **`claude-sonnet-5`** |
| PWA | `manifest.json` + service worker próprio (`public/sw.js`, cache v2) |

O upgrade para Sonnet 5 no OCR aconteceu em 24/07/2026; antes era Haiku 4.5, que errava placas com frequência.

## Estrutura

```
patio-pwa/
├── middleware.ts                  gate de rotas + refresh de sessão
├── lib/supabase/
│   ├── client.ts                  client de browser (anon)
│   ├── server.ts                  client de server component (cookies)
│   ├── admin.ts                   client service_role — hoje não usado
│   ├── middleware.ts              updateSession(): a lógica real do gate
│   └── types.ts                   tipos manuais do domínio
├── app/
│   ├── login/                     e-mail + senha (server action)
│   ├── home/
│   │   ├── page.tsx               saudação, badge de pendências, últimas 10 movimentações
│   │   ├── actions.ts             undoMovement()
│   │   ├── history-list.tsx       lista + botão Desfazer
│   │   ├── nova/                  o fluxo de lançamento (ver abaixo)
│   │   └── pendencias/            fila de entradas faltantes
│   ├── api/ask/route.ts           assistente do dashboard (não é tela de operador)
│   ├── push-setup.tsx             opt-in de Web Push
│   └── register-sw.tsx            registra o SW em produção
├── public/
│   ├── sw.js  manifest.json  icon-*.png
│   └── unidas.html  refran.html   portais servidos por rewrite
├── scripts/
│   ├── create-operators.mjs       cria os 3 operadores no Auth
│   └── generate-icons.mjs
└── supabase/migrations/
```

## Autenticação

Supabase Auth com e-mail e senha. Três detalhes que já custaram tempo:

**A server action de login não usa `redirect()`.** Ela devolve `{ ok: true }` e o cliente faz `router.refresh()` seguido de `router.replace('/home')`. O `NEXT_REDIRECT` conflitava com o `await` dentro do `onSubmit`.

**O middleware precisa copiar os cookies para o redirect.** A função `createRedirectWithCookies()` existe porque, sem ela, o JWT refrescado pelo `getUser()` se perde e o navegador entra em loop infinito entre `/home` e `/login`. Foi um bug real, com centenas de requisições por segundo.

**Autorização é em duas camadas.** O middleware barra quem não está logado; a página `/home` refaz a verificação e exige `role = 'operator'` **e** `yard` preenchido. Ou seja, **admin não entra no PWA**.

Rotas públicas (sem sessão): `/`, `/login`, `/api/auth`, `/api/ask`, `/manifest.json`, ícones, `/unidas`, `/refran`.

Contas: `bira@fleetflow.app` (SSA), `diego@fleetflow.app` (REC), `marcos@fleetflow.app` (NAT). Criadas por `scripts/create-operators.mjs`; reset de senha pelo painel do Supabase.

## O fluxo de uma movimentação

```
 1. FOTO            input capture=environment (câmera traseira), limite de 25 MB
        │
 2. COMPRESSÃO      canvas → maior lado 1920px, JPEG 85%
        │           (para caber no limite de 5 MB da API de visão)
        │
 3. UPLOAD          bucket privado patio-evidence
        │           path {yard}/{yyyy-mm-dd}/{uuid}.jpg
        │
 4. VISÃO           server action baixa a imagem e manda pro claude-sonnet-5
        │           → placa, modelo, marca, tipo_carro, movimento, data, confiança
        │
 5. NORMALIZAÇÃO    normalizePlate() corrige OCR por posição
        │
 6. REVISÃO         operador confere e ajusta os toggles
        │
 7. CONFIRMAÇÃO     saveMovement() grava veículo + cobranças + histórico
        │
 8. SUCESSO         placa, modelo, badges e data — sem nenhum valor em R$
```

### O OCR de placa

O maior problema prático do app. A placa Mercosul segue o padrão `LLLNLNN` — posições 1 a 3 e 5 são letras, 4, 6 e 7 são números. O modelo confunde `O↔0`, `I↔1`, `S↔5`, `B↔8`, `G↔6`, `Q↔0`, `Z↔2`.

Duas defesas:

1. **O prompt ensina o formato** e traz exemplos de erros reais já vistos (`TXPOD06` → `TXP0D06`, `TCR7B5G` → `TCR7B50`).
2. **`normalizePlate()` corrige por posição** — se a posição exige dígito e veio letra, converte; e vice-versa.

Se mesmo assim a placa não bater com o padrão Mercosul, a confiança cai para `baixa` e uma observação pede conferência ao operador. Placas no formato antigo (`LLLNNNN`) também são rebaixadas: são raras na frota e é exatamente nisso que um Mercosul mal lido se transforma.

### A tela de revisão

Três toggles e quatro campos de texto:

| Toggle | Quando aparece |
|---|---|
| **Cliente** (Stellantis / Unidas) | só para o operador de **SSA** |
| **Tipo do carro** (Ativação / Desmobilização) | escondido quando o cliente é Unidas |
| **Movimento** (Entrada / Saída) | sempre |

Um badge colorido mostra a confiança do OCR. O estado do fluxo vive em `sessionStorage` — fechar a aba entre a revisão e a confirmação perde o lançamento (com fallback correto para o início).

## O que é gravado no banco

### Entrada

**Veículo** — busca por placa. Se existe, atualiza (`status='patio'`, pátio, data de entrada, `withdrawal_date` limpo, `notes` **sobrescrito**). Se não existe, insere, preenchendo `year` com o ano corrente e `chassi` com `PENDING-{placa}`.

**Cobranças — só Stellantis.** Os preços são lidos de `service_pricing` (não hardcoded):

| | Taxa | 1ª diária |
|---|---|---|
| `service_key` | `ativacao` ou `desmobilizacao` | `diaria` |
| `client_charge` | 190,00 ou 88,00 | **0,00** (carência) |
| `partner_cost` | 123,50 ou 57,20 | 6,50 |
| `grace_applied` | `false` | `true` |

**Unidas não gera nenhuma cobrança** — a medição é por ocupação agregada.

**Histórico** — sempre, para os dois clientes: `ativacao_entrada`, `desmobilizacao_entrada` ou `guarda_entrada`.

### Saída

Busca o veículo por placa **+ cliente + `status='patio'`**. Se não achar, a mensagem é explícita: *"Confira o cliente selecionado."*

Atualiza `withdrawal_date`, muda o status para `finalizado` e **concatena** o texto novo em `notes` com ` | `. **Nenhuma cobrança é criada.**

## Tela de pendências

Resolve o furo que o pipeline Vexsoft expõe: uma **saída** detectada por vistoria em um veículo que **nunca teve entrada registrada**. Sem a entrada não há data de chegada, taxa nem diárias — o faturamento fica incompleto.

A tela lista os registros de `entradas_pendentes` com status `pendente` e pede uma coisa só: **a data em que o carro entrou no pátio**. Ao salvar, o app cria o veículo já como `finalizado` (entrada e saída conhecidas), lança a taxa de ativação e **uma diária por dia** do intervalo, respeitando a carência, e baixa a pendência.

> ⚠️ A tela **não filtra por pátio** — hoje Bira consegue ver e resolver pendências de Natal. Ver [pendências](10-pendencias-e-riscos.md).

## Tela de conferência de pátio (`/home/patio`) — 19/08

Posição atual do pátio do operador (placa, veículo, cliente, entrada, dias) com botões **⬇ XLSX** e **⬇ PDF** (bibliotecas carregadas de CDN sob demanda). Mesma lista dos botões de exportação do dashboard — serve para imprimir e conferir o pátio fisicamente. Acesso pelo atalho "📋 Conferir pátio" na home.

## Auditoria física semanal (`/home/auditoria`) — 19/08

Toda segunda-feira às 8h um robô cria uma auditoria por praça (`audits` + `audit_items`, snapshot dos veículos em pátio) e o trigger do banco dispara push aos operadores. A tela mostra barra de progresso e um cartão por veículo com duas ações:

- **📷 Tirar foto** — abre a câmera traseira, comprime localmente (máx. 1600 px, JPEG 80%) e sobe para o bucket `auditorias` (`{audit_id}/{placa}_{ts}.jpg`); o item vira `fotografado`.
- **"Não está"** — marca `nao_encontrado` (com confirmação), sinalizando divergência a investigar.

Quando todos os itens são resolvidos, a auditoria muda sozinha para `concluida`. Um banner violeta na home aparece enquanto houver auditoria pendente do pátio do operador.

## Notificações push

O operador vê um botão "Ativar notificações de pendências" na home (só quando a permissão ainda está indefinida). Ao aceitar, a assinatura vai para `push_subscriptions`. Quando o pipeline insere uma linha em `entradas_pendentes`, um trigger chama a Edge Function `notify-entrada-pendente`, que dispara o push para todos os inscritos e remove assinaturas mortas.

No iOS o `PushManager` só existe com o app **instalado na tela de início** — no Safari comum o botão simplesmente não aparece.

> ⚠️ A tabela `push_subscriptions` está **vazia**: ninguém assinou ainda, então nenhuma notificação está sendo entregue.

## Botão Desfazer

Aparece nos lançamentos das **últimas 24 horas** feitos pelo **próprio operador**.

| Movimento desfeito | O que acontece |
|---|---|
| Entrada | Cancela a taxa e a 1ª diária **daquele dia** e arquiva o veículo (`status='archived'`, o que também o tira do cron) |
| Saída | Devolve o veículo para `patio` e limpa `withdrawal_date`. Nenhuma cobrança é tocada |

Sempre grava um registro `undo` no histórico. Nada é apagado.

**O que ele não faz:** não cancela diárias lançadas pelo cron em dias posteriores, não restaura as `notes` originais e não devolve o `status`/`client_id` anterior quando a entrada foi uma reentrada. Nesses casos, correção manual.

## Variáveis de ambiente

| Variável | Onde é usada |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | todos os clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clients de browser e middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/ask` e o script de criação de operadores |
| `ANTHROPIC_API_KEY` | visão (OCR) e assistente |
| `DASH_PASSWORD_SHA256` | *(opcional)* autenticação do assistente |
| `ASK_MODEL` | *(opcional)* troca o modelo do assistente |

Todas configuradas em **Production** e **Preview** na Vercel.

## Deploy

```bash
cd ~/Desktop/"FLeet Flow"/patio-pwa
npx vercel deploy --prod
```

Não há repositório Git nem CI: o deploy é feito da pasta local. O Vercel CLI builda remotamente, o que também contorna o problema de arquivos "placeholder" do iCloud.

## Instalação no celular

- **iOS:** Safari → Compartilhar → "Adicionar à Tela de Início"
- **Android:** Chrome → menu → "Instalar app"

O service worker é *network-first* (o operador precisa de dado fresco) e mantém em cache apenas o shell para uma tela mínima offline.
