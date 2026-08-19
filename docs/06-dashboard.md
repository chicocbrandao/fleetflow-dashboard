# 6. Dashboard interno e Chat IA (dash.fleetflow.digital)

Página estática única (`index.html`) neste repositório, publicada via **GitHub Pages** com domínio custom `dash.fleetflow.digital`. Deploy = `git push`.

## Seções

- **KPIs**: em pátio (com quebra por praça), ativações/desmobs do mês, faturamento.
- **Veículos em Pátio**: tabela filtrável por praça com dias em pátio e custo acumulado, e botões **XLSX** / **PDF** que exportam a posição do dia (com coluna "Conferido" em branco) para impressão e conferência física.
- **Consulta de veículo** por placa (histórico completo + cobranças).
- **Medição Mensal**: por mês/praça/tipo, com geração de planilha e PDF no padrão aceito pela Stellantis. A medição **exclui a Unidas** (que fatura por ocupação).
- **Unidas × Refran**: KPIs ao vivo, gráfico de ocupação (`daily_occupancy`), fatura estimada dos dois contratos e simulador.

## Chat IA ("Perguntar à IA")

Widget flutuante que conversa com a Edge Function **`dash-chat`**:

1. O front envia o histórico + token de acesso.
2. A função roda um loop agêntico com o Claude (`claude-sonnet-5`), que recebe o **esquema do banco e as regras de negócio** no system prompt e a ferramenta `run_sql`.
3. `run_sql` executa via `exec_readonly_sql()` — **somente SELECT/WITH**, transação read-only, timeout 10 s, resultado truncado a 60 KB. A IA não consegue alterar dados.
4. Resposta em markdown renderizada no widget; blocos de código `csv` viram botão **Baixar CSV**.

Usos típicos: "quantos carros da Stellantis no pátio por praça?", "faturamento de julho", "carros há mais de 30 dias no pátio", "relatório de diárias cobráveis de agosto em CSV", "o que o robô Vexsoft processou hoje?".

## Bibliotecas

Supabase JS, Chart.js, SheetJS (XLSX), jsPDF + AutoTable, marked — todas via CDN (jsDelivr). Nenhum build: editar `index.html` e dar push.
