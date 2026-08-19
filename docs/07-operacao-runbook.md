# 7. Operação e runbook

## Rotinas automáticas

| Quando | O quê | Onde conferir |
|---|---|---|
| Diário 07:05 (Bahia) | `launch_daily_charges()`: diárias Stellantis + snapshot `daily_occupancy` (7 dias retroativos) | `vehicle_service_charges` / `daily_occupancy` |
| A cada hora (min 20) | Robô Vexsoft processa e-mails de vistoria | `vexsoft_ingest` |
| Segunda 08:00 (Bahia) | Robô cria auditoria física por praça + push aos PWAs | `audits` / `audit_items` |
| Mensal (manual) | Medição → aprovação Stellantis → NFS-e → e-Gate | e-mails + planilhas em `Stellantis PE/` |

## Rotina do encarregado

1. **Entrada de ativação** (carro 0 km chega): PWA → Nova movimentação → foto → confirmar.
2. **Desmobilização**: fazer a vistoria no Vexsoft na entrada e na saída — o robô lança sozinho; o PWA é backup.
3. **Push de pendência**: tocar → informar data de entrada → salvar.
4. **Push de auditoria** (segunda): abrir, fotografar carro a carro; usar "Não está" quando o carro não for encontrado.
5. **Conferência avulsa**: Home → Conferir pátio → imprimir PDF ou baixar XLSX.

## Correções de dados

Sempre via SQL com registro em `notes` (nunca sobrescrever silenciosamente):

```sql
UPDATE vehicles SET withdrawal_date = 'AAAA-MM-DD',
  notes = notes || ' | SAIDA CORRIGIDA p/ DD/MM (origem, data)'
WHERE plate = 'AAA0A00';
```

Ao corrigir datas, ajustar as diárias em `vehicle_service_charges` (remover dias após a saída corrigida; recalcular carência se a entrada mudou). Lançamentos retroativos completos: inserir veículo + taxa + `generate_series` de diárias (ver migrações de 14/08 como modelo).

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Robô não lançou uma vistoria | e-mail fora da janela de 3 dias ou exceção | ver `vexsoft_ingest` (`acao`/`detalhe`); reprocessar manualmente se preciso |
| Push não chega no celular | permissão não concedida ou inscrição expirada | reabrir PWA → "Ativar notificações"; conferir `push_subscriptions` |
| Dashboard com dado "atrasado" | snapshot de ocupação ainda não rodou | aguardar cron 07:05 ou recalcular; KPIs "hoje" são ao vivo |
| Chat IA erro 401 | token do widget divergente da função `dash-chat` | conferir token no `index.html` × função |
| Deploy Vercel travado em "Retrieving project" | token CLI expirado | `vercel login` no Mac e repetir |
| Placa duplicada ao inserir | placa é UNIQUE global | é o mesmo carro voltando: usar reentrada (update), não insert |

## Contatos Stellantis (medição)

Ativação 0 km: **Aleilza Silva** / Alana Condini. Desmobilização: **Kleuder Luz**. Fiscal/e-Gate: Rosangela Galvincio. Coletas: Jennifer Germano.

## Pendências conhecidas (19/08/2026)

- Saídas físicas de REC a confirmar com Diego: SYY8E49, SYA4D35, TDS8G29, TCD8E35; entrada do TEJ3B07 (22/06?).
- Revisão de glosa de junho com o Kleuder aguardando resposta (7 placas retroativas).
- Aprovações formais a obter: ativação Março (R$ 4.686, NF 2026240) e ativação Junho (R$ 2.360, NF 2026247).
- `dash.fleetflow.com.br` aguarda acesso ao DNS da KingHost.
- CNPJ definitivo da Unidas a cadastrar (placeholder no banco).
