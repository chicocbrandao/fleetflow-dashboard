# 07 — Integrações

## Pipeline Vexsoft — ingestão automática de vistorias

**Em operação desde 13/08/2026.** É hoje a **entrada principal de dados da Stellantis**; o PWA virou backup para esse cliente (com deduplicação automática). A Unidas continua 100% no PWA.

### A decisão de fundo

Toda movimentação de veículo Stellantis passa por uma vistoria da **Vexsoft**, que gera um PDF e envia um e-mail. Em vez de depender de o operador lembrar de lançar no app, o sistema passou a **ler a vistoria como fonte primária**. Junto com isso ficou combinado com a Stellantis que as ativações passariam a ter vistoria também na **entrada** — antes só existia a da entrega.

Escopo: REC, SSA e NAT.

### Como funciona

```
  Gmail (chico@azpark.com.br)
   from:no-reply@vexsoft.com.br
   newer_than:3d
        │
        ▼
  dedup por gmail_message_id  ────────▶ já processado? para aqui
        │
        ▼
  corpo do e-mail → ID da vistoria, placa, link do PDF
        │
        ▼
  abre o PDF em pdf-vist.vexsoft.com.br
   → Tipo Operação, km, marca/modelo, endereço
        │
        ▼
  roteamento de pátio pelo endereço
   José Bonifácio/Recife ....... REC
   Salvador / Lauro de Freitas .. SSA
   Natal ........................ NAT
        │
        ▼
  valida a placa no padrão Mercosul
        │
        ▼
  DECISÃO
   ├─ sem veículo ativo com essa placa ......... cria ENTRADA (+ taxa + 1ª diária)
   ├─ já em pátio, mesmo tipo .................. lança SAÍDA (sem cobrança)
   ├─ movimento já registrado no PWA (±2 dias) . duplicado_pwa → não lança
   └─ conflito / placa inválida / endereço      . excecao → push, não lança
        │
        ▼
  registra a decisão em vexsoft_ingest
```

### Agendamento

Tarefa agendada externa, cron `20 * * * *` (UTC) — de hora em hora. Exceções e conclusões relevantes disparam push notification.

### Rastreamento

Cada e-mail processado vira uma linha em `vexsoft_ingest`, com a decisão no campo `acao`:

| `acao` | Significa |
|---|---|
| `entrada_criada` | veículo entrou (ou reentrou) e a cobrança foi lançada |
| `saida_lancada` | ciclo fechado |
| `duplicado_pwa` | o operador já tinha lançado; nada foi feito |
| `excecao` | precisa de decisão humana |

`gmail_message_id` é UNIQUE — é o que garante que reprocessar a caixa não duplica nada.

### Limitações conhecidas

- **E-mails com mais de 3 dias não são processados.** Retroativos continuam sendo trabalho manual.
- Se a Vexsoft mudar o formato do e-mail ou do PDF, o robô passa a gerar exceções — o conserto é ajustar o prompt da tarefa agendada.
- O pipeline **não baixa nem arquiva os PDFs assinados**. Se uma auditoria exigir os comprovantes, isso ainda é feito à parte.

### Entradas pendentes

Quando a vistoria indica uma **saída** de um veículo sem entrada registrada, o pipeline não inventa a data: cria uma linha em `entradas_pendentes` e notifica. O operador informa a data pela tela de pendências do PWA, que então cria o veículo, a taxa e todas as diárias do intervalo. Ver [05](05-pwa-operadores.md#tela-de-pendências).

---

## Portais externos — Unidas e Refran

Duas páginas de prestação de contas, uma por contraparte, publicadas desde 24/07/2026.

| | Unidas | Refran |
|---|---|---|
| URL | `unidas.fleetflow.digital` | `refran.fleetflow.digital` |
| Também em | `app.fleetflow.digital/unidas` | `app.fleetflow.digital/refran` |
| Papel | cliente (receita) | fornecedor (custo) |
| Edge Function | `dashboard-unidas` | `dashboard-refran` |
| Projeto Vercel | `fleetflow-unidas` | `fleetflow-refran` |

**Stack:** HTML estático único, sem framework e sem dependência externa — o gráfico de barras é **SVG desenhado à mão**. Tema claro/escuro automático.

**Acesso:** token na query string (`?t=…`). Sem token, a página mostra um portão pedindo o código. A validação real acontece na Edge Function.

**O que a Unidas vê:** carros no pátio agora, média diária do mês, dias acima do mínimo de 50, fatura parcial, gráfico de ocupação com a parte excedente destacada, lista de carros no pátio (placa, modelo, entrada, dias) e a memória de cálculo dia a dia. Navegação mês a mês.

**O que a Refran vê:** ocupação de hoje, vagas contratadas, carro-dias excedentes no mês e o repasse parcial — com a ocupação **somando todos os clientes**. **Não vê placas, nomes de clientes nem receita**, por decisão de projeto.

> ⚠️ **Duplicação:** os arquivos em `fleetflow-unidas/index.html` e `patio-pwa/public/unidas.html` são idênticos byte a byte (idem para a Refran). São duas cópias para manter em sincronia e dois caminhos de deploy. Vale escolher um canal único.

---

## Notificações push

| Peça | Onde |
|---|---|
| Opt-in do operador | `app/push-setup.tsx` no PWA |
| Registro das assinaturas | tabela `push_subscriptions` |
| Disparo | trigger `trg_notify_entrada_pendente` em `entradas_pendentes` → função `notify_entrada_pendente()` → Edge Function `notify-entrada-pendente` |
| Entrega | Web Push (VAPID) |

A notificação usa `tag: 'entrada-pendente'`, então uma nova substitui a anterior em vez de empilhar. Assinaturas que respondem 404 ou 410 são apagadas automaticamente.

**Estado atual: a tabela está vazia.** Nenhum operador assinou, então nenhuma notificação chega. Ver [10](10-pendencias-e-riscos.md).

---

## Bot de Telegram — legado

**Status: superado, sem registro de desligamento formal.**

Bot standalone em Node.js (`node-telegram-bot-api` + Gemini 2.5 Flash + API REST do Supabase), rodando no Mac Mini em `~/projetos/fleetflow-bot/`. Recebia screenshots de WhatsApp encaminhados, extraía placa/modelo/tipo/data com o Gemini e inseria no Supabase. Tinha comandos `/status`, `/buscar PLACA` e `/help`, além de retry com backoff para as respostas 429 e 503 do free tier.

Foi criado em meados de 2026 para substituir o **Neo/OpenClaw**, que parou de funcionar em maio (loop de timeout de rede, configuração desatualizada, rate limit do relay).

**O que o substituiu:** o **PWA**, desde 25/05/2026, para a operação diária; e o **pipeline Vexsoft**, desde 13/08/2026, para a Stellantis.

Pendências relacionadas: nunca foi criado o LaunchAgent para auto-start, e o token do bot e a chave do Gemini estão registrados em texto claro na documentação interna — devem ser rotacionados quando o bot for oficialmente aposentado.

---

## Script `baixar_vex.sh` — legado

Script Bash gerado automaticamente que baixava os 136 comprovantes originais de vistoria de abril a julho/2026 e os concatenava em quatro PDFs, um por grupo de medição. Artefato pontual de fechamento, não um componente do sistema: as URLs são fixas e específicas daquelas vistorias.

Serve como referência para o dia em que for preciso arquivar comprovantes assinados de forma automática — algo que o pipeline atual não faz.
