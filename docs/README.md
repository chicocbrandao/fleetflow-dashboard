# FleetFlow — Documentação do sistema

Documentação técnica do FleetFlow, a operação de pátios de veículos que atende **Stellantis** (ativação e desmobilização de frota em Salvador, Recife e Natal) e **Unidas** (guarda de veículos em Salvador).

> ⚠️ **Este repositório é público.** Nenhum documento aqui contém chaves de API, tokens de acesso, senhas ou hashes. Segredos ficam nas variáveis de ambiente da Vercel, nos secrets do Supabase e no gerenciador de credenciais — nunca no Git. Ao editar estas páginas, mantenha essa regra.

Última revisão: **14/08/2026**.

## Índice

| # | Documento | O que cobre |
|---|---|---|
| 01 | [Visão geral](01-visao-geral.md) | O que o sistema faz, quem usa, quais são as peças |
| 02 | [Arquitetura](02-arquitetura.md) | Diagrama, componentes, domínios, deploy, fluxo de dados |
| 03 | [Banco de dados](03-banco-de-dados.md) | Schema, tabelas, funções, cron, RLS, storage, legado |
| 04 | [Regras de negócio](04-regras-de-negocio.md) | Matriz de cobrança, diárias, contratos, regras de "não fazer" |
| 05 | [PWA dos operadores](05-pwa-operadores.md) | `app.fleetflow.digital` — fluxos, telas, gravação no banco |
| 06 | [Dashboard e assistente de IA](06-dashboard-e-assistente.md) | `dash.fleetflow.digital` — medição, KPIs, chat SQL |
| 07 | [Integrações](07-integracoes.md) | Vexsoft, portais Unidas/Refran, push, bot de Telegram |
| 08 | [Operação e runbook](08-operacao-e-runbook.md) | Deploy, monitoramento, tarefas comuns, troubleshooting |
| 09 | [Histórico e conciliações](09-historico-e-conciliacoes.md) | Linha do tempo e os fechamentos que corrigiram a base |
| 10 | [Pendências e riscos](10-pendencias-e-riscos.md) | Dívida técnica, achados de segurança, o que está em aberto |

## Leitura mínima

Quem vai **mexer no código** deve ler 02, 03, 04 e o documento do componente que vai tocar.
Quem vai **operar / fechar medição** deve ler 04, 06 e 08.
Quem está **retomando o projeto do zero** deve ler tudo, na ordem.

## Convenções

- **Praças:** `SSA` (Salvador/BA), `REC` (Recife/PE), `NAT` (Natal/RN).
- **Fuso:** toda regra de negócio usa `America/Bahia` (UTC−3). O banco guarda em UTC.
- **Moeda:** valores em R$ aparecem sempre como `cliente / parceiro` — o que a Stellantis paga e o que o pátio terceirizado recebe.
- **"Cliente"** = quem paga o FleetFlow (Stellantis, Unidas). **"Parceiro"/"fornecedor"** = quem opera o pátio (AZPark, Via Total, Refran).
