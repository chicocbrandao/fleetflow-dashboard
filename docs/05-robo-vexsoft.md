# 5. Robô Vexsoft (ingestão automática de vistorias)

Tarefa agendada **de hora em hora** (minuto 20) no Claude Code Remote. Trigger `trig_01SvA9uqKtngjFQyAfYNZ8aZ`. Substituiu o lançamento manual como fonte primária; o PWA vira backup e retaguarda das ativações.

## Ciclo

1. Busca e-mails `from:no-reply@vexsoft.com.br newer_than:3d`.
2. **Dedup por e-mail**: `gmail_message_id` já em `vexsoft_ingest` → pula (idempotência).
3. Extrai do corpo: id da vistoria, placa, data/hora e link do PDF; lê o PDF (Tipo Operação, km, modelo, endereço).
4. **Praça pela UF do endereço**: Bahia → SSA · Pernambuco → REC · Rio G. do Norte → NAT. Só é exceção se nem UF nem cidade conhecida forem identificáveis.
5. **Validação de placa** Mercosul com correção posicional (O↔0, I↔1, S↔5, B↔8).
6. **Dedup PWA**: movimento equivalente já registrado (mesma direção/tipo, ±2 dias) → `duplicado_pwa`, nada é lançado.

## Regras de lançamento

| Situação | Ação |
|---|---|
| Desmob., veículo inexistente | **Entrada**: cria veículo + taxa R$ 88 + 1ª diária (carência) |
| Desmob., veículo finalizado/arquivado | **Reentrada**: reativa o registro + taxa + 1ª diária |
| Desmob., veículo em pátio (desmob.) | **Saída**: finaliza, sem cobrança nova |
| Ativação, veículo em pátio | **Saída** (entrada veio do PWA), sem cobrança nova |
| **Ativação sem entrada no PWA** | **Não lança**: insere em `entradas_pendentes` → push automático para o encarregado resolver com a data de entrada. Ação `aguardando_entrada_pwa` |
| Conflito (tipo divergente, carro da Unidas etc.) | **Exceção**: nada é lançado; push de aviso ao gestor |

> Por determinação da Stellantis, **entrada de ativação não passa pelo Vexsoft** — é sempre registrada pelo operador no PWA. Toda vistoria de ativação é tratada como saída.

## Regras de ouro

- Nunca processar o mesmo e-mail duas vezes (`vexsoft_ingest` é a fonte de verdade).
- Nunca cobrar taxa/diária numa saída.
- Nunca tocar em veículos da Unidas por este fluxo.
- Nunca criar entrada de ativação automaticamente.
- Na dúvida, exceção com aviso — nunca lançamento errado.

## Observabilidade

Cada vistoria processada gera uma linha em `vexsoft_ingest` com `acao` e `detalhe` legível:

```sql
SELECT created_at, plate, acao, detalhe FROM vexsoft_ingest ORDER BY created_at DESC LIMIT 20;
SELECT * FROM vexsoft_ingest WHERE acao = 'excecao' ORDER BY created_at DESC;
```
