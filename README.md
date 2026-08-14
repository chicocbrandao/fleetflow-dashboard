# FleetFlow — Dashboard interno

Painel de gestão da operação de pátios do FleetFlow (Stellantis e Unidas), publicado em
**https://dash.fleetflow.digital** pelo GitHub Pages.

É um único `index.html`, sem build: bibliotecas por CDN (Chart.js, SheetJS, jsPDF, Supabase JS)
e leitura direta do banco. Traz KPIs, gráficos, a seção Unidas × Refran com simulador de contrato,
consulta por placa, veículos em pátio, medição mensal com export para Excel e PDF, e um
assistente de IA que responde perguntas e monta relatórios sobre o banco.

## Documentação do sistema

A documentação técnica completa do FleetFlow — não só deste dashboard — está em **[`docs/`](docs/)**.

| # | Documento |
|---|---|
| 01 | [Visão geral](docs/01-visao-geral.md) |
| 02 | [Arquitetura](docs/02-arquitetura.md) |
| 03 | [Banco de dados](docs/03-banco-de-dados.md) |
| 04 | [Regras de negócio](docs/04-regras-de-negocio.md) |
| 05 | [PWA dos operadores](docs/05-pwa-operadores.md) |
| 06 | [Dashboard e assistente de IA](docs/06-dashboard-e-assistente.md) |
| 07 | [Integrações](docs/07-integracoes.md) |
| 08 | [Operação e runbook](docs/08-operacao-e-runbook.md) |
| 09 | [Histórico e conciliações](docs/09-historico-e-conciliacoes.md) |
| 10 | [Pendências e riscos](docs/10-pendencias-e-riscos.md) |

## Como publicar uma alteração

```bash
git add -A && git commit -m "..." && git push origin main
```

O GitHub Pages republica em cerca de 2 minutos.

> ⚠️ **Repositório público.** Não commite chaves de API, tokens, senhas ou hashes.
