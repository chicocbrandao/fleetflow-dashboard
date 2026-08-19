# FleetFlow — Sistema de Gestão de Pátios

Sistema completo de gestão de pátios de veículos da **FleetFlow / CPB Auto Peças e Pneus Ltda** (CNPJ 39.372.547/0001-53), operando os pátios de **Salvador (SSA)**, **Recife (REC)** e **Natal (NAT)** para os clientes **Stellantis Locadora** e **Unidas**, com fornecimento de pátio pela **Refran** em Salvador.

## Componentes

| Componente | URL | Hospedagem |
|---|---|---|
| Dashboard interno (gestão) | https://dash.fleetflow.digital | GitHub Pages (este repositório) |
| PWA operacional (encarregados) | https://app.fleetflow.digital | Vercel (`patio-pwa`) |
| Portal do cliente Unidas | https://unidas.fleetflow.digital | Vercel |
| Portal do fornecedor Refran | https://refran.fleetflow.digital | Vercel |
| Banco de dados + funções | Supabase (projeto `sqbjxabftqtzdigjhivl`) | Supabase Cloud |
| Robô de ingestão Vexsoft | tarefa agendada (hora em hora) | Claude Code Remote |
| Robô de auditoria semanal | tarefa agendada (segunda 8h) | Claude Code Remote |

## Documentação

1. [Arquitetura](docs/01-arquitetura.md)
2. [Banco de dados](docs/02-banco-de-dados.md)
3. [Regras de negócio e contratos](docs/03-regras-de-negocio.md)
4. [PWA operacional](docs/04-pwa-operacional.md)
5. [Robô Vexsoft](docs/05-robo-vexsoft.md)
6. [Dashboard e Chat IA](docs/06-dashboard.md)
7. [Operação e runbook](docs/07-operacao-runbook.md)
8. [Segurança e acessos](docs/08-seguranca-acessos.md)

A versão consolidada em PDF está em `docs/pdf/FleetFlow-Documentacao.pdf`.

*Última revisão: 19/08/2026.*
