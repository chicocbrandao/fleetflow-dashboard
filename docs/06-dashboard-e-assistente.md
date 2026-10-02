# 06 — Dashboard interno e assistente de IA

**URL:** `https://dash.fleetflow.digital` · **Repo:** `chicocbrandao/fleetflow-dashboard` (este) · **Local:** `~/projetos/fleetflow-dashboard/`

Um único arquivo `index.html` servido pelo GitHub Pages. Sem build, sem framework, sem backend próprio: todas as bibliotecas vêm de CDN e os dados vêm direto do Supabase com a chave anônima.

## Bibliotecas

| Lib | Uso |
|---|---|
| `@supabase/supabase-js` | leitura das tabelas |
| `chart.js` | gráficos |
| `xlsx` (SheetJS) | export Excel do pátio e das tabelas do assistente |
| `exceljs` | export Excel da **medição** (formato Stellantis, com estilos e fórmulas) |
| `medicao.js` (próprio) | regras da medição + montagem da planilha, compartilhado com scripts Node |
| `jspdf` + `jspdf-autotable` | export PDF |

> **Nota histórica:** o jsPDF é carregado do **jsDelivr**. A URL antiga do cdnjs (2.5.2) passou a devolver 404 em 11/08/2026 e quebrou o export PDF sem aviso. Se o PDF parar de funcionar, o primeiro suspeito é o CDN.

## Acesso

Uma senha comparada por SHA-256 no próprio JavaScript. Não é autenticação forte — é um portão para não deixar a operação exposta em uma URL pública. A sessão fica em `sessionStorage`.

Desde 14/08/2026 o login também guarda a senha em `sessionStorage`, porque é ela que autentica as chamadas ao assistente.

## Seções

**KPIs** — total de veículos, em pátio (com quebra por praça), finalizados, ativações e desmobilizações do mês corrente, e a medição do mês.

**Gráficos** — distribuição por praça e por status.

**Unidas × Refran (Salvador)** — carros Unidas hoje, ocupação total do pátio, fatura Unidas do mês, repasse Refran do mês e a margem da guarda. Abaixo, um gráfico empilhado de 30 dias (Stellantis + Unidas) com a linha das 50 vagas contratadas, e um **simulador** que projeta custo, receita e margem para diferentes cenários de vagas contratadas, mensalidade e valor de excedente — a ferramenta para renegociar com a Refran.

**Consulta de veículo** — busca por placa e mostra o ciclo completo: praça, tipo, entrada, saída, dias totais, dias cobrados, custódia, serviço e total estimado.

**Veículos em pátio** — tabela filtrável por praça, com dias de permanência e custo acumulado.

**Medição mensal** — seletor de mês, filtro por tipo (todos / ativação / desmobilização), totalizadores e a tabela detalhada por veículo, com **export para Excel e PDF**. A medição **exclui a Unidas** (que tem apuração própria).

### Export Excel da medição — formato Stellantis (desde 02/10/2026)

Em setembro/2026 a Stellantis devolveu a medição de agosto com uma aba própria, **"Validação" — Demonstrativo de Faturamento**, e pediu que a medição passasse a ser apresentada nesse layout. O botão **Excel** da medição gera **duas pastas** nesse formato, uma por serviço — `MM.AAAA - Apuracao Ativacao <Mês> <Ano> - CPB.xlsx` e `MM.AAAA - Apuracao Desmobilizacao <Mês> <Ano> - CPB.xlsx` (o navegador pode pedir permissão para "baixar vários arquivos" na primeira vez). O filtro Todos/Ativação/Desmobilização da tela não afeta o export: saem sempre as duas. Cada pasta tem:

- **Aba `Resumo`** — uma linha por praça (veículos, diárias, check list, total) com fórmulas apontando para as abas de detalhe, total do serviço e as regras aplicadas.
- **Uma aba por praça** (`SSA - Ativação`, `REC - Ativação`, `NAT - Ativação` na pasta de ativação; `... - Desmob` na de desmobilização; só as praças com veículo no mês) com as colunas da aba Validação, na mesma ordem e com os mesmos títulos: Placa · Modelo · Data Inicial Entrada · Período de Cobrança INICIO/FINAL · Valor da Diária · Qtd Diárias (`=E-D+1`) · Carência Diárias · Desconto carência (`=F*H`) · Valor Devido Diárias (`=MAX(0,G*F-I)`) · Valor do Check List · Lavagem · Abastecimento · Valor Final (`=SUM(J:M)`) · Observações · **Validação** e **Comentários** (em branco, para a Stellantis preencher). Linha 1 traz `SUBTOTAL(9, …)` — respeita o filtro automático — e a última linha o total da aba.

Regras de linha: remanescente de mês anterior entra com período a partir do dia 1º e sem carência; veículo que entrou no mês traz o check list (190/88) e a carência de 7 dias (ou os dias que ainda restavam dela, se a entrada foi no fim do mês anterior). As fórmulas ficam vivas: se a Stellantis mexer numa data, os valores recalculam.

O código fica em **`medicao.js`** (`calcMeasurementRows` + `buildMedicoesMes`), carregado pelo `index.html` e também usável em Node: **`scripts/gera_medicao.js <ano> <mês> [pasta]`** (`cd scripts && npm install` uma vez) lê o banco e grava as duas pastas — foi assim que as planilhas de setembro/2026 foram geradas e conferidas contra o export do navegador, célula a célula. Alterar uma regra ali muda o painel e a planilha ao mesmo tempo.

> **Correção embutida (02/10):** a carência de estadias curtas estava errada no painel — carro que entrava e saía dentro da carência pagava 1 diária (foi o caso do TEC8D82 na medição de agosto, R$ 10 a mais, que a Stellantis marcou como *Nok*). O cálculo agora conta os dias isentos de forma inclusiva (dia da entrada + 6).

## Cálculos feitos no navegador

O dashboard não lê `vehicle_service_charges` para montar a medição — ele **recalcula** a partir de `vehicles`, aplicando as regras direto no JavaScript. Isso é rápido e simples, mas significa que **o dashboard e o banco podem divergir** se as cobranças tiverem sido ajustadas manualmente. Para o número contratual, a fonte é sempre `vehicle_service_charges`; para o número gerencial do dia a dia, o dashboard basta.

Constantes no topo do arquivo: carência de 7 dias, diária R$ 10, ativação R$ 190, desmobilização R$ 88, diária Unidas R$ 6.

**KPIs de "hoje" contam veículos ao vivo**, não o snapshot: o `daily_occupancy` só é atualizado às 07:05 e não enxerga lançamentos feitos durante o dia nem retroativos. Essa distinção foi introduzida em 29/07/2026, depois de o painel mostrar 13 carros Unidas quando havia 20.

## Correções aplicadas (histórico)

| Data | Correção |
|---|---|
| 24/07 | `parseType` passou a reconhecer `GUARDA` e a respeitar a ordem das palavras em `notes` |
| — | `daysBetween` passou a contar o dia de entrada (+1) |
| — | custo passou a somar a taxa, não só as diárias |
| 29/07 | KPIs de "hoje" passaram a contar veículos ao vivo |
| — | medição mensal passou a excluir a Unidas |
| 11/08 | jsPDF migrado para o jsDelivr |
| 14/08 | assistente de IA |
| 02/10 | export Excel da medição no formato Stellantis, em duas pastas (Ativação / Desmobilização) — `medicao.js` + ExcelJS + `scripts/gera_medicao.js`; carência de estadias curtas corrigida |

## Como atualizar

```bash
cd ~/projetos/fleetflow-dashboard
# edite index.html
git add -A && git commit -m "..." && git push origin main
# o GitHub Pages publica em ~2 minutos
```

---

# Assistente de IA

Adicionado em 14/08/2026. Um box de chat no dashboard que responde perguntas sobre a operação e monta relatórios consultando o banco.

## Por que não fala direto com a Anthropic

O `index.html` é público — uma chave de API no HTML seria uma chave vazada. O chat conversa com a rota **`/api/ask`** dentro do PWA, que roda na Vercel e é onde `ANTHROPIC_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já existiam. Nenhuma variável nova precisou ser criada.

```
navegador (dash)  ──POST /api/ask──▶  Vercel (patio-pwa)
   x-ff-key: senha                        │
                                          │ tool use
                                          ▼
                                    Anthropic  claude-sonnet-5
                                          │
                                    run_sql │ make_chart
                                          ▼
                                    Supabase  ai_read_sql()
                                          │  role ff_ai_readonly
                                          ▼
                                      Postgres (só SELECT)
```

## Segurança em três camadas

1. **Acesso** — o header `x-ff-key` leva a senha do dashboard; o servidor compara o SHA-256 com o hash conhecido. Quem tem a senha do dash tem o assistente, e nada mais.
2. **CORS** — só `dash.fleetflow.digital`, `chicocbrandao.github.io` e localhost.
3. **Banco** — toda consulta passa por `ai_read_sql()`, que troca para o papel `ff_ai_readonly` (sem nenhum privilégio de escrita, sem acesso a `auth` ou `storage`), limita a 2.000 linhas e derruba a consulta em 20 segundos. CTEs que modificam dados são recusadas pelo próprio Postgres.

Não é possível, por construção, o assistente alterar qualquer coisa no banco.

## Ferramentas do modelo

| Ferramenta | O que faz |
|---|---|
| `run_sql(sql, is_report, title)` | Executa um SELECT. Quando `is_report` é verdadeiro, aquele resultado vira a tabela baixável |
| `make_chart(type, title, labels, series)` | Renderiza um gráfico Chart.js no chat |

O modelo pode encadear várias consultas — explorar, errar, ler a mensagem de erro e corrigir — antes de responder. O limite é de 12 rodadas por pergunta.

## O que o modelo sabe

O *system prompt* carrega, além do schema das 10 tabelas úteis:

- os UUIDs de Stellantis e Unidas
- a matriz de cobrança e a carência de 7 dias
- os contratos Unidas e Refran
- o formato do campo `notes` e a regra de "vale a primeira palavra"
- as armadilhas: excluir `archived`, excluir `status='cancelled'`, Unidas fora da medição Stellantis, `yard` nulo em registro antigo, `withdrawal_date` como `timestamptz`

É esse contexto que faz a diferença entre um gerador de SQL genérico e um assistente que acerta o número da medição.

## Saídas

A resposta do chat pode trazer três coisas: o texto, uma **tabela** (com botões de Excel e PDF que exportam o **conjunto completo**, não só as 50 linhas de prévia) e um **gráfico**.

## Custo

Aproximadamente **R$ 0,05 a R$ 0,30 por pergunta** com `claude-sonnet-5`, dependendo de quantas consultas o modelo precisa rodar. A variável `ASK_MODEL` permite trocar o modelo sem mexer no código.

## Exemplos de pergunta

- *"Medição de agosto por praça"*
- *"Carros parados há mais de 30 dias"*
- *"Faturamento mês a mês em 2026, com gráfico"*
- *"Margem da guarda Unidas × Refran neste mês"*
- *"Vistorias Vexsoft sem lançamento no sistema"*
