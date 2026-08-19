# 3. Regras de negócio e contratos

## Cliente Stellantis Locadora (SSA, REC, NAT)

Serviço de recebimento, armazenagem, preparação, entrega e desmobilização (RDA 101542447, PO 62066766).

| Serviço | Preço cliente | Custo parceiro |
|---|---|---|
| Taxa de ativação (carro 0 km) | R$ 190,00 | R$ 123,50 |
| Taxa de desmobilização | R$ 88,00 | R$ 57,20 |
| Diária (após carência de 7 dias) | R$ 10,00 | R$ 6,50 |

**Fluxo de ativação**: carro 0 km chega para preparação → **entrada registrada no PWA** (por determinação da Stellantis, a vistoria Vexsoft de ativação existe **apenas na saída**) → saída com vistoria Vexsoft.

**Fluxo de desmobilização**: carro usado devolvido → vistoria Vexsoft **na entrada e na saída**.

**Medição**: mensal, por tipo (ativação → Aleilza/Alana; desmobilização → Kleuder). Após validação por e-mail, emite-se NFS-e (Lauro de Freitas) e lança-se no portal **e-Gate** com o pedido de compra indicado. Histórico: medições aprovadas e faturadas de Dez/2025 a Jun/2026 somam **R$ 46.033** (NFs 2026238–2026247, sequência completa).

## Cliente Unidas (somente SSA)

Guarda de veículos. **Sem cobrança por carro**: a fatura é `max(piso, soma das diárias)` onde piso = R$ 9.000/mês (50 carros × R$ 6 × 30) e cada carro-dia acima de 50 carros soma R$ 6. Medição pela tabela `daily_occupancy`. Início 27/07/2026. Portal de acompanhamento com token próprio.

## Fornecedor Refran (pátio de SSA)

50 vagas por R$ 3.500/mês; vaga-dia excedente a R$ 4,00. A ocupação considera **Stellantis + Unidas somados** em SSA. Portal próprio com token.

## Pátios e responsáveis

| Praça | Local | Encarregado |
|---|---|---|
| SSA | Salvador / Lauro de Freitas (Refran) | Bira (AZPark) |
| REC | Recife — Rua José Bonifácio 1315, Torre | Diego (Via Total) |
| NAT | Natal / Parnamirim | Marcos (Via Total RN) |

## Vexsoft (vistorias)

Aplicativo de vistoria usado nos pátios. Cada vistoria gera e-mail de `no-reply@vexsoft.com.br` para `chico@azpark.com.br` com link do PDF (`pdf-vist.vexsoft.com.br`). O PDF traz placa, **Tipo Operação** (Ativação 0 km / Desmobilização), km, modelo e endereço — insumos do robô do capítulo 5. Km ≈ 0 confirma ativação.

## Princípios de auditoria

- A **vistoria Vexsoft é a prova documental** de que o serviço aconteceu; toda divergência sistema × físico se resolve por ela + conferência no pátio.
- Correções de dados nunca apagam histórico: sempre `notes` com data e origem (ex.: "SAIDA CORRIGIDA p/ 15/05 (físico Bira 14/08)").
- Fechamentos: medições aprovadas até **junho/2026**; julho/agosto em aberto.
