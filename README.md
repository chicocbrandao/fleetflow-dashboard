# FleetFlow — Sistema de Gestão de Pátios

Sistema completo de gestão de pátios de veículos da **FleetFlow / CPB Auto Peças e Pneus Ltda** (CNPJ 39.372.547/0001-53), operando os pátios de **Salvador (SSA)**, **Recife (REC)** e **Natal (NAT)** para os clientes **Stellantis Locadora** e **Unidas**, com fornecimento de pátio pela **Refran** em Salvador.

## Componentes

| Componente | URL | Hospedagem |
|---|---|---|
| Dashboard interno (gestão + assistente IA) | https://dash.fleetflow.digital | GitHub Pages (este repositório) |
| PWA operacional (encarregados) | https://app.fleetflow.digital | Vercel (`patio-pwa`) |
| Portal do cliente Unidas | https://unidas.fleetflow.digital | Vercel |
| Portal do fornecedor Refran | https://refran.fleetflow.digital | Vercel |
| Banco de dados + funções | Supabase (projeto `sqbjxabftqtzdigjhivl`) | Supabase Cloud |
| Robô de ingestão Vexsoft | tarefa agendada (hora em hora) | Claude Code Remote |
| Robô de auditoria física | tarefa agendada (segunda 8h) | Claude Code Remote |

## Documentação

1. [Visão geral](docs/01-visao-geral.md)
2. [Arquitetura](docs/02-arquitetura.md)
3. [Banco de dados](docs/03-banco-de-dados.md)
4. [Regras de negócio](docs/04-regras-de-negocio.md)
5. [Pátio PWA (operadores)](docs/05-pwa-operadores.md)
6. [Dashboard e assistente de IA](docs/06-dashboard-e-assistente.md)
7. [Integrações (Vexsoft, push, e-Gate)](docs/07-integracoes.md)
8. [Operação e runbook](docs/08-operacao-e-runbook.md)
9. [Histórico e conciliações](docs/09-historico-e-conciliacoes.md)
10. [Pendências e riscos](docs/10-pendencias-e-riscos.md)

A versão consolidada em PDF está em [`docs/pdf/FleetFlow-Documentacao.pdf`](docs/pdf/FleetFlow-Documentacao.pdf).

*Última revisão: 19/08/2026.*
