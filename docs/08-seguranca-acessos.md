# 8. Segurança e acessos

## Autenticação e autorização

- **PWA**: Supabase Auth (e-mail/senha). `profiles.role = 'operator'` + `yard` limitam o escopo de cada encarregado. RLS habilitado em todas as tabelas de negócio (política para `authenticated`).
- **Dashboard interno**: página estática; usa a anon key com as políticas de leitura do banco. O chat IA exige token adicional embutido.
- **Portais Unidas/Refran**: somente leitura, atrás de Edge Functions com token longo na URL. Não expõem dados de outros clientes.

## Chaves e segredos (onde vivem)

| Segredo | Local |
|---|---|
| `ANTHROPIC_API_KEY` (OCR + chat) | Vercel env do `patio-pwa` e Edge Function `dash-chat` |
| VAPID (web push) | Edge Functions `notify-entrada-pendente` / `push-broadcast`; chave pública no `push-setup` do PWA |
| Token do chat do dashboard | `index.html` (dash) × função `dash-chat` |
| Tokens dos portais externos | Edge Functions `dashboard-*` |
| Service role key do Supabase | Apenas dentro das Edge Functions (env automático) — nunca no front |

## Barreiras importantes

1. **Chat IA não escreve**: `exec_readonly_sql()` rejeita qualquer coisa que não seja SELECT/WITH, roda em transação read-only com timeout de 10 s e só o `service_role` pode executá-la.
2. **Robôs idempotentes**: dedupe por `gmail_message_id` (Vexsoft) e por `(yard, week_start)` (auditoria) impedem lançamento duplo.
3. **Cobrança**: nenhuma saída gera cobrança; nenhuma entrada de ativação é criada automaticamente; carros da Unidas nunca recebem charges.
4. **Trilha de auditoria**: `vehicle_history`, `notes` datadas, `vexsoft_ingest` e fotos em Storage.

## Recomendações futuras

- Rotacionar a `ANTHROPIC_API_KEY` e os tokens dos portais periodicamente.
- Migrar segredos hardcoded das Edge Functions para secrets do Supabase.
- Adicionar login ao dashboard interno quando houver mais usuários além do gestor.
- Backup: Supabase PITR já cobre o banco; exportação mensal dos buckets de fotos é desejável.
