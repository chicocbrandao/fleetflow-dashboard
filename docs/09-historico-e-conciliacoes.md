# 09 — Histórico e conciliações

## Linha do tempo

| Data | Marco |
|---|---|
| até ~mai/2026 | **Legado.** Dados vindos do bot Neo/OpenClaw e do projeto ProLine. Base com registros parados: 31 veículos legados, 24 deles como `patio` havia mais de 60 dias. Dezembro/2025 a março/2026 ficaram **sem nenhuma cobrança lançada** — só descoberto em agosto |
| mai/2026 | O Neo/OpenClaw para de funcionar (loop de timeout, configuração desatualizada, rate limit do relay) |
| 18/05/2026 | Incidente **TZD7D87**: um único print de "Saída" gera ativação e desmobilização ao mesmo tempo → nasce a regra **1 print = 1 evento** |
| **25/05/2026** | **PWA em produção.** Migrations de RLS e papel `operator`, coluna `yard`, cron de diárias, três operadores criados, bucket de evidências, deploy na Vercel + DNS. A nova matriz `tipo_carro × movimento` substitui as regras antigas. Valores em R$ removidos da tela do operador |
| 30/05/2026 | Dois extras de adesivo pedidos para placas inexistentes no banco → nasce a regra de **conferir a placa antes de lançar extra** |
| entre mai e jul | Bot de Telegram standalone construído para substituir o Neo |
| **24/07/2026** | **Contratos Unidas + Refran entregues** — as sete fases: banco, PWA, cron, portal Unidas, portal Refran, dashboard interno, teste ponta a ponta. Subdomínios verificados. No mesmo dia, conferências físicas em SSA e REC |
| **27/07/2026** | Início da vigência dos contratos Unidas e Refran |
| 25–28/07/2026 | Bira registra 20 carros Unidas em SSA (sete lançados retroativamente em 28/07) |
| 29/07/2026 | **Correção do dashboard**, que mostrava 13 em vez de 20: snapshots recalculados, cron passa a recalcular janela deslizante de 7 dias, KPIs de "hoje" passam a contar veículos ao vivo |
| 11/08/2026 | **Regularização de REC** com base nas vistorias Vexsoft e aplicação das listas de saídas físicas |
| **13/08/2026** | **Pipeline Vexsoft em operação.** O PWA vira backup para a Stellantis |
| 14/08/2026 | **Conciliação Vexsoft × FleetFlow** (abril a agosto) e fechamento da medição abr–jul em R$ 27.158 |
| 14/08/2026 | **Assistente de IA** no dashboard |

---

## Os episódios de conciliação

Quatro rodadas de acerto entre o que o banco dizia e o que o pátio tinha de fato. Valem como documentação porque explicam **por que um terço das cobranças está cancelada** e por que certas regras existem.

### Conferência física de Salvador — 24/07/2026

A partir de fotos de posição das 11h29 (16 carros):

- **Cinco placas corrigidas por erro de OCR:** `TDY8176→TDY8I76`, `TCR7B5G→TCR7B50`, `TXPOD06→TXP0D06`, `SYQ5E5Q→SYQ5E50`, `OMZ7C49→QMZ7C47`
- **12 saídas lançadas** com data provisória e **duas entradas criadas** (Rampage e Renegade, desmobilização)

Detalhe instrutivo: `QMZ7C49` existia mesmo, como **outro** veículo, já fechado em 19/06 pelo PWA. Os dois carros eram reais — a correção de OCR não os fundiu.

### Conferência física de Recife — julho/2026

Diego contou **13 veículos** no pátio; o sistema tinha **17** como `patio`.

- 7 conferiam
- 2 eram erro de placa (`TYH8D65` × `TVH8D65`, V↔Y; `TDS1B66` × `TDZ1B66`, S↔Z)
- 4 estavam no pátio e não no sistema
- 8 estavam no sistema e não no pátio — provavelmente saíram sem registro

Ficou estabelecido que **a conferência física é a fonte de verdade**. O impacto financeiro veio nas rodadas seguintes.

### Regularização de Recife — 11/08/2026

**(a) Retroativos a partir das vistorias.** Dos 15 carros da planilha do Diego, sete não estavam no sistema. Foram lançados com entrada e saída reais, gerando **R$ 718 de taxas e R$ 720 de custódia**.

O caso dos dois Citroën Basalt merece nota: a vistoria de 18/05 era **saída**, não entrada. O `TYG8G53` estava como `patio` desde 11/05 acumulando diárias — **81 diárias erradas foram removidas**. Foi aqui que se confirmou a regra: *para ativação, a vistoria marca a saída*.

Outra lição: a "entrada 20/05" que aparecia na planilha era **data de abertura de OS**, não data física.

**Impacto: cerca de R$ 1.818 recuperados** na medição de abril a junho.

**(b) Listas de saídas físicas.** Dezoito datas corrigidas em SSA e REC, com nota `CANCELADA: pós-saída real (conferência 11/08)`.

**Impacto: 1.122 diárias canceladas = −R$ 10.860.**

Um conflito interessante: `SYM5E95` aparecia nas fotos de 24/07, mas a lista dizia saída em 22/07. **Prevaleceu a lista** — daí a regra de que listas com data valem mais que fotos de posição.

Posição pós-correção: SSA com 34 carros (14 Stellantis + 20 Unidas), REC com 13.

### Conciliação Vexsoft × FleetFlow — 14/08/2026

Comparação de **144 vistorias** de abril a 14/08 contra os movimentos do sistema.

**Diagnóstico:**

- **30 vistorias sem nenhum movimento correspondente** (janela de ±3 dias)
- 27 movimentos sem vistoria — a maioria são entradas de ativação, que historicamente não tinham vistoria (esperado)
- **Recife é o furo grande:** 13 das 14 vistorias órfãs de julho são de REC, com 10 carros presos como `patio`, o mais antigo desde 09/03
- **Natal:** uma vistoria órfã e **zero movimento no sistema desde março**
- **Salvador está alinhada** — Bira lança pelo PWA de forma consistente
- **Dezembro/2025 a março/2026: zero cobranças** para cerca de 30 veículos cadastrados

**A planilha de fechamento da Proline** (recebida no mesmo dia) trouxe uma distinção que virou regra: a coluna **"DATA DA SAÍDA" é confiável** e bate com as vistorias; a coluna **"DATA DA OS" não é a data de entrada** no pátio.

**Correções aplicadas:**

| Item | Efeito |
|---|---|
| Placas corrigidas: `OMY5C40→QMY5C40`, `TCH2B52→TCW2B52`, `TZ04A91→TZO4A91` | — |
| `SINGH34` arquivado (duplicata de OCR de `SIN0H34`) | −R$ 190 de taxa indevida |
| `QMY5C40` fechado em 15/07 | −R$ 300 (30 diárias) |
| `TDZ4D72` fechado em 17/07 | −R$ 280 (28 diárias); taxa de R$ 190 **mantida** |
| `TEJ3B07` com entrada corrigida de 31/07 para 22/06 | 40 diárias refeitas |
| Três retroativos criados em REC | taxas + diárias completas |

**Medição consolidada após as correções:**

| Mês | Valor |
|---|---|
| Abril | R$ 4.152 |
| Maio | R$ 5.500 |
| Junho | R$ 8.968 |
| Julho | R$ 8.450 |
| **Abril a julho** | **R$ 27.070** |

O total anterior era R$ 26.264 — as conciliações **aumentaram** a medição, apesar de terem cancelado mais de mil diárias. O que se recuperou em lançamentos faltantes superou o que se devolveu em cobrança indevida.

### Limpeza de duplicatas — 14/08/2026

Ao criar o índice único de cobranças, apareceram três linhas duplicadas que nenhuma conciliação anterior tinha pego, porque não eram erro de data e sim de gravação:

- **`TEY8C68`** (REC, 09/06) — a mesma desmobilização foi lançada duas vezes no PWA, com seis minutos de diferença e duas fotos distintas. Cobrou R$ 88 a mais do cliente e R$ 63,70 a mais do parceiro.
- **`QMZ7C56`** (SSA, 22/05) — a diária de entrada foi lançada duas vezes, com três semanas de intervalo. R$ 6,50 a mais no parceiro.

As três foram canceladas e junho caiu de R$ 9.056 para **R$ 8.968**. O índice único impede que se repita.

---

## Contradições registradas

Pontos onde os registros históricos divergem. Ficam documentados para evitar retrabalho:

**`TVH8D65` × `TYH8D65`.** A conferência de julho tratou como erro de digitação; a conciliação de 14/08 concluiu que são a **primeira e a segunda passagem do mesmo carro** — registros legítimos distintos, que a constraint UNIQUE de `plate` impede de coexistir. **Prevalece a versão de 14/08.**

**`TDS8G29`.** Em julho aparece como "no pátio físico e não no sistema"; em 14/08 aparece como entrada por vistoria em 11/05. Ou foi cadastrado no intervalo sem registro, ou uma das leituras está errada.

**Horário do cron.** Registros de maio citam 03:05 UTC; os de julho, 10:05 UTC. **O valor atual no banco é `5 10 * * *`** — o horário foi mudado para casar com a regra "todo dia às 7h" dos contratos.

**Status do bot de Telegram.** Descrito como ativo em julho, marcado para desligamento em maio. Não há registro de decisão final.
