# 4. PWA operacional (app.fleetflow.digital)

Next.js (App Router) + Supabase Auth. Cada operador tem `profiles.yard` e só opera sua praça. Instalável na tela de início (manifest + service worker próprio em `public/sw.js`, cache network-first + web push).

## Telas

### Home (`/home`)
Saudação, pátio do operador, botão **Nova movimentação**, atalho **Conferir pátio**, últimas 10 movimentações. Banners dinâmicos: entradas pendentes de ativação (âmbar) e auditoria física da semana (violeta). Botão "🔔 Ativar notificações" aparece enquanto o push não foi autorizado.

### Nova movimentação (`/home/nova` → revisar → confirmar)
1. Foto do carro → upload para `evidencias` → **OCR com Claude Vision** (`claude-sonnet-5`) com regras de placa Mercosul e `normalizePlate()` (O→0, I→1, S→5, B→8 por posição; formato antigo vira "confiança baixa").
2. Revisão: em SSA aparece o seletor de cliente (Stellantis/Unidas); tipo (Ativação/Desmobilização) não se aplica à guarda Unidas; movimento Entrada/Saída; campos editáveis.
3. Confirmação grava: entrada Stellantis = veículo + taxa + 1ª diária (carência); entrada Unidas = só o veículo (medição por ocupação); saída = finaliza sem cobrança nova. Tudo logado em `vehicle_history`.

### Pendências (`/home/pendencias`)
Lista as saídas de ativação que chegaram pelo Vexsoft sem entrada no PWA. O encarregado informa a **data de entrada** e o sistema cria o veículo completo (entrada + saída + taxa R$ 190 + diárias com carência) e baixa a pendência. É a tela aberta pelo push "Entrada pendente: PLACA".

### Conferir pátio (`/home/patio`)
Posição atual do pátio do operador (placa, veículo, cliente, entrada, dias) com botões **XLSX** e **PDF** — a mesma lista do dashboard, para imprimir e conferir fisicamente.

### Auditoria (`/home/auditoria`)
Auditoria fotográfica semanal. Barra de progresso e um cartão por veículo com **Tirar foto** (câmera traseira, compressão local a 1600 px JPEG, upload para o bucket `auditorias`) ou **"Não está"** (marca `nao_encontrado` para investigação). Quando todos os itens são resolvidos a auditoria conclui sozinha.

## Web push

- Chaves VAPID próprias; inscrição salva em `push_subscriptions` (upsert por endpoint).
- Recebimento no `sw.js` (`push` → notificação; `notificationclick` → abre a URL indicada).
- Android: funciona nativamente (Chrome). iOS: requer PWA instalado e iOS 16.4+.
- Emissores: `notify-entrada-pendente` (pendência de ativação) e `push-broadcast` (auditoria semanal e avisos gerais).

## Deploy

Sem repositório git — deploy direto por `npx vercel deploy --prod` na pasta `patio-pwa`. Variáveis em `.env.local`/Vercel (Supabase URL/keys, `ANTHROPIC_API_KEY`).
