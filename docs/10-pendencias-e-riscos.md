# 10 — Pendências e riscos

Situação em **14/08/2026**. Ordenado por gravidade dentro de cada bloco.

---

## Riscos de infraestrutura

### 🔴 O código do PWA existe em um lugar só

`~/Desktop/FLeet Flow/patio-pwa/` **não é um repositório Git**. Não há histórico, não há branch, não há backup fora do build da Vercel. Um acidente com o Mac ou com a sincronização do iCloud leva junto o app que sustenta a operação.

**Correção:** `git init` + repositório privado no GitHub. É o item de maior retorno desta lista.

### 🟡 Segredos em texto claro na pasta do Desktop

`FleetFlow_Credenciais_AI_Agents.docx`, `patio-pwa/.env.local` e `proline/.env.local` estão numa pasta sincronizada por iCloud. Migrar para um gerenciador de senhas.

### 🟡 Tokens e chaves VAPID como constantes no código

Os tokens de acesso dos portais Unidas e Refran e o par de chaves VAPID do push estão escritos dentro das Edge Functions, não nos secrets do Supabase. Rotacioná-los hoje exige alterar código.

---

## Achados de segurança no banco

### 🔴 Quatro tabelas são legíveis sem login

`vehicles` (com placa, chassi e renavam), `daily_occupancy`, `supply_contracts` (com os valores dos contratos) e `vexsoft_ingest` têm policy de SELECT para `anon`. Como a chave anônima está publicada no HTML do dashboard e dos portais, **qualquer pessoa com a URL consegue ler essas tabelas**.

Isso é o que permite o dashboard funcionar como HTML estático. Fechar exige mover a leitura para uma Edge Function com token — o mesmo padrão já usado nos portais.

### 🟢 Funções `SECURITY DEFINER` expostas — corrigido em 14/08

`launch_daily_charges()` era chamável por qualquer um com a chave anônima, o que permitia **disparar o lançamento de cobranças** de fora. `get_pending_users()` devolvia **e-mails de `auth.users`** para `anon`.

Ambas foram revogadas de `anon` (e `launch_daily_charges` também de `authenticated`) na migration `harden_definer_function_grants`. O cron continua funcionando porque roda como `postgres`.

### 🟡 Oito funções sem `search_path` fixo

Funções `SECURITY DEFINER` legadas do ProLine sem `SET search_path` — vetor clássico de escalonamento. `ai_read_sql` e `launch_daily_charges` **estão corretas**.

### 🟡 Views `clients` e `partners` são `SECURITY DEFINER`

Executam com as permissões de quem as criou, não de quem consulta. São legado do ProLine e não têm uso no pátio.

### 🟡 Proteção contra senhas vazadas desligada

O Supabase Auth tem a checagem contra o HaveIBeenPwned desabilitada. Ligar em Auth → Password Protection.

### 🟡 Chave anônima escrita dentro de uma função do banco

`notify_entrada_pendente()` guarda a chave anônima em texto claro no corpo da função — visível para quem consegue ler `pg_proc`, inclusive pelo assistente de IA.

---

## Integridade de dados

### 🔴 Não há UNIQUE que impeça diária duplicada

`vehicle_service_charges` não tem constraint de `(vehicle_id, service_key, charge_date)`. A idempotência depende inteiramente do `NOT EXISTS` dentro de `launch_daily_charges()`. Qualquer inserção feita fora dessa função pode duplicar cobrança sem que o banco reclame.

**Correção:** criar índice único parcial para `service_key = 'diaria'`.

### 🟡 O modelo não representa reentrada

`vehicles.plate` é UNIQUE global. Um carro que passa duas vezes pelo pátio não pode ter dois registros — a segunda passagem sobrescreve a primeira ou fica só anotada em `notes`. Caso conhecido: `TVH8D65` / `TYH8D65`.

### 🟡 Preços hardcoded na tela de pendências

`app/home/pendencias/actions.ts` escreve 190 / 123,50 / 10 / 6,50 e dois `pricing_id` fixos, enquanto `save.ts` lê tudo de `service_pricing`. Se a tabela de preços mudar, o fluxo de pendências passa a lançar valor errado silenciosamente.

### 🟡 Pendências não são filtradas por pátio

Tanto o contador da home quanto a listagem trazem pendências de **todos** os pátios. Bira consegue ver e resolver uma pendência de Natal. `resolverEntrada` também não valida se o pátio bate.

### 🟡 Sem transação no fluxo de pendências

O veículo é criado e as cobranças são inseridas em passos separados. Se o segundo falhar, sobra um veículo `finalizado` sem nenhuma cobrança.

### 🟡 O ciclo de faturamento não fecha no banco

Das 3.527 cobranças, 2.363 estão `pending` e 1.164 `cancelled`. **Nenhuma** está `invoiced` ou `paid`. Os campos existem e não são usados: o faturamento real acontece fora do sistema.

---

## Funcionalidades incompletas

### 🟠 Push não chega a ninguém

`push_subscriptions` está **vazia**. Todo o caminho existe — opt-in, trigger, Edge Function, service worker — mas nenhum operador aceitou a notificação. No iOS, o botão só aparece com o app instalado na tela de início.

### 🟠 Não existe UI de admin

Lançar extras, corrigir cobranças e ajustar datas ainda é trabalho de SQL. O assistente de IA reduziu bastante o atrito, mas ele é **somente leitura** por decisão de projeto.

### 🟡 Operador não tem como trocar a senha

Não existe fluxo de "esqueci minha senha" nem de troca no primeiro acesso. O reset é manual, pelo painel do Supabase.

### 🟡 Vistorias antigas não são reprocessadas

O pipeline só olha e-mails dos últimos 3 dias. Qualquer retroativo continua sendo trabalho manual.

### 🟡 Os portais estão duplicados

`fleetflow-unidas/index.html` e `patio-pwa/public/unidas.html` são idênticos byte a byte (idem Refran). Duas cópias, dois deploys, uma chance de divergirem.

---

## Pendências de operação

| Item | Desde |
|---|---|
| **Backfill de dez/2025 a mar/2026** — cerca de 30 veículos sem nenhuma cobrança | 14/08 |
| **Natal:** vistoria órfã `TES3H85` e varredura de tudo que passou por NAT de abril em diante (zero movimento desde março) | 14/08 |
| **Recife:** 10 desmobilizações com entrada por vistoria e sem data de saída, dependendo de conferência física | 14/08 |
| **Recife:** duas ativações 0 km (`TZX9A97`, `TZX9A94`) com vistoria de saída e sem data de entrada | 14/08 |
| **Treinamento do Diego (REC)** — quase não registra movimentos no PWA; foi o que produziu quase todo o passivo de conciliação | 24/07 |
| **Datas a confirmar:** `TDZ1B66`, `TEC5H72`, `TYG3I70`, `TZP9G94`, `TYG8G55` | 11/08 |
| **Extras de adesivo não lançados:** `UAA9C82` (R$ 250) e `TEV9G06` (R$ 150). As placas não existiam em maio, mas **existem hoje** — o bloqueio provavelmente caiu | 30/05 |
| **`TCM9A04`** — apareceu na conferência física de REC em julho e não reaparece em nenhum registro posterior | 24/07 |
| **CNPJ real da Unidas** (hoje é placeholder) | 24/07 |
| **Conferir a primeira fatura da Unidas** no fechamento | 24/07 |
| **Rotacionar chaves** expostas em conversas: service role e Anthropic; e também token do Telegram e chave do Gemini | 25/05 |
| **Desligar formalmente o bot de Telegram** | 25/05 |

---

## Performance

Sem impacto hoje (o banco é pequeno), mas vale saber antes de crescer:

- **43 chaves estrangeiras sem índice**, incluindo `vehicle_history.vehicle_id`, `vehicles.client_id` e `daily_occupancy.client_id`
- **26 policies de RLS reavaliam `auth.uid()` por linha** — a correção é envolver em `(select auth.uid())`
- **19 conjuntos de policies permissivas duplicadas**, todas avaliadas em OR a cada consulta

`vehicle_service_charges` cresce cerca de 40 linhas por dia.

---

## Limpeza sugerida

- `Cursor/` — pasta vazia
- Três ZIPs do ProLine somando ~616 MB, redundantes com a pasta `proline/`
- `setup-fleetflow.sh` — aponta para o repositório do ProLine, não deve ser executado
- `lib/supabase/admin.ts` — código morto, ninguém importa
- `supabase/migrations/20260525_create_desmobilize_vehicle_rpc.sql` — a função foi removida do banco, a migration ficou
- Arquivos de lock órfãos (`~$...docx`, `.~lock...#`)
