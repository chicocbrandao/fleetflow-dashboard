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
  roteamento de pátio pela UF do endereço (regra de 19/08)
   Bahia (Salvador, Lauro de Freitas,
          Camaçari, Arembepe…) ......... SSA
   Pernambuco (Recife, Torre…) ......... REC
   Rio Grande do Norte (Natal,
          Parnamirim, Candelária…) ..... NAT
   (exceção só se nem UF nem cidade
    conhecida forem identificáveis)
        │
        ▼
  valida a placa no padrão Mercosul
        │
        ▼
  DECISÃO
   ├─ DESMOB sem veículo ativo ................. cria ENTRADA (+ taxa + 1ª diária)
   ├─ DESMOB já em pátio ....................... lança SAÍDA (sem cobrança)
   ├─ ATIVAÇÃO com veículo em pátio ............ lança SAÍDA (entrada veio do PWA)
   ├─ ATIVAÇÃO SEM entrada no PWA (19/08) ...... NÃO lança: insere em
   │    entradas_pendentes → push ao operador  → acao aguardando_entrada_pwa
   │    (por determinação da Stellantis, entrada de ativação é só pelo PWA)
   ├─ movimento já registrado no PWA (±2 dias) . duplicado_pwa → não lança
   └─ conflito / placa inválida / endereço      . excecao → push, não lança
        │
        ▼
  registra a decisão em vexsoft_ingest
```

### Onde o robô roda (desde 19/08/2026)

Script Python **no Mac mini**: `Desktop/FLeet Flow/robos/robo_vexsoft.py`, agendado pelo launchd (`br.fleetflow.robo-vexsoft`) **de hora em hora no minuto 35**. Ele lê a caixa `chico@clampatrimonial.com.br` (AZPark Mail, onde chegam os e-mails do Vexsoft) via IMAP com senha de app, extrai os campos do PDF com pypdf e grava no Supabase via REST. A praça é determinada pelo **CEP/cidade do endereço da vistoria** (4xxxx→SSA, 50–56xxx→REC, 59xxx→NAT). Logs em `robos/logs/robo_vexsoft.log`. Exceções disparam push (`push-broadcast`).

Transição: a tarefa agendada na nuvem (cron `20 * * * *` UTC) roda **em paralelo até ~26/08/2026** como rede de segurança e depois será desativada. O dedupe por `gmail_message_id` **e por `vistoria_id`** garante que os dois nunca lançam a mesma vistoria duas vezes.

### Rastreamento

Cada e-mail processado vira uma linha em `vexsoft_ingest`, com a decisão no campo `acao`:

| `acao` | Significa |
|---|---|
| `entrada_criada` | veículo entrou (ou reentrou) e a cobrança foi lançada |
| `saida_lancada` | ciclo fechado |
| `duplicado_pwa` | o operador já tinha lançado; nada foi feito |
| `aguardando_entrada_pwa` | ativação sem entrada — pendência criada e push enviado ao operador |
| `excecao` | precisa de decisão humana |

`gmail_message_id` é UNIQUE e o robô também confere o `vistoria_id` — é o que garante que reprocessar a caixa (ou rodar dois robôs em paralelo) não duplica nada.

### Limitações conhecidas

- **E-mails com mais de 3 dias não são processados.** Retroativos continuam sendo trabalho manual.
- Se a Vexsoft mudar o formato do e-mail ou do PDF, o robô passa a gerar exceções — o conserto é ajustar as expressões regulares em `robos/robo_vexsoft.py` (funções `parse_email` e `read_pdf`).
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
