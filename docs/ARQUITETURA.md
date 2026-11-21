# LeonidaPlay — Arquitetura do MVP

> Status: decisões fechadas em 21/11/2026. Fonte da verdade do modelo de dados: `packages/db/prisma/schema.prisma`.

## 1. Decisões fechadas

| Tema | Decisão |
|---|---|
| Mercado | Brasil — região `BR-SP` (atende também PY, UY, AR por latência) |
| Pagamento de entrada | **Somente Pix via Mercado Pago (0,99%)** → carteira de créditos. Sem cartão. Sem Asaas. |
| Repasse | **Toda sexta-feira via Pix**: sessões encerradas até **quinta 23:59** (garante ≥ 24 h de retenção), mínimo **R$ 20** (abaixo acumula). Lote aprovado manualmente no admin, comprovante salvo por repasse. |
| Fiscal | CPF na fase de teste, com registro de cada repasse + contrato de intermediação aceito pelo anfitrião. MEI quando escalar. |
| Anfitrião | Precisa **só do PS5**. Relay na nuvem conecta via Remote Play pela PSN. |
| Credenciais | Token PSN + chaves Remote Play da **conta secundária** guardados cifrados (envelope encryption). Só o relay decifra. |
| Jogo | GTA 6 **Online**, conta secundária com gasto zero, PS Plus ativo no console principal. |
| Quedas | Reembolso automático proporcional ao segundo, como crédito na carteira. |
| Penalidade | 3 falhas em 7 dias → suspensão 7 d → 30 d → banimento. |
| Marca | LeonidaPlay (risco de marca aceito conscientemente; manter domínio reserva e base de e-mails própria). |
| Fase 2 | USDT (Binance Pay / gateway) + revendedores de créditos, novas regiões com relay próprio, anfitriões estrangeiros pagos em USDT. |

## 2. Componentes

```
                          ┌─────────────────────────────────────────┐
                          │ apps/web — Next.js (Vercel)              │
 Jogador / Anfitrião ────►│ UI PT/EN (next-intl), carteira, vitrine, │
   (navegador)            │ onboarding, admin, webhooks Mercado Pago │
        │                 └──────────────┬──────────────────────────┘
        │                                │ Postgres (Neon) via packages/db
        │                                │ grants Ed25519 / comandos
        │ WebRTC (vídeo + input)         ▼
        │                 ┌─────────────────────────────────────────┐
        └────────────────►│ services/relay — Go (Oracle Cloud SP)    │
                          │ Pion WebRTC + libchiaki (chiaki-ng)      │
                          │ filtro de input, corte no exp, telemetria│
                          └──────────────┬──────────────────────────┘
                                         │ Remote Play via PSN (holepunch)
                                         ▼
                                  PS5 do anfitrião (casa, CGNAT ok)
```

- **apps/web**: Next.js App Router + TypeScript + Tailwind + next-intl. Moeda vem da **região**, não do idioma.
- **services/relay**: processo Go stateful, um por VM, N sessões por VM. Banda: Oracle SP (10 TB/mês grátis, depois ~US$ 0,0085/GB). AWS/GCP inviabilizam a margem.
- **packages/db**: Prisma 7 + Postgres.
- **packages/ledger**: regras de dinheiro puras (TS) — rateio, captura proporcional, lançamentos. Toda movimentação passa por aqui.

## 3. Fluxo de uma sessão

1. Jogador escolhe console na vitrine → **teste de ping** (navegador → relay → PS5).
2. Escolhe pacote → `REQUESTED` → valor sai da carteira para retenção (`FUNDS_HELD`).
3. Relay acorda o PS5, entra na conta secundária e abre o GTA 6 Online (`HOST_PREPARING`).
4. Jogo na tela → `READY` → jogador tem 3 min para conectar (senão `CANCELLED`, estorno total).
5. **1º frame jogável** → `ACTIVE`, `startedAt` gravado, servidor emite **grant assinado** com `exp`.
6. T-60 s → `EXPIRING` (aviso na tela). No `exp` o relay corta **localmente** (relógio monotônico), mesmo se o servidor estiver fora.
7. `ENDED` → captura no ledger → `settlementStatus = HOLD` por 24 h → `SETTLED` → entra no repasse de sexta.

### Máquina de estados — sessão

```
REQUESTED ─► FUNDS_HELD ─► HOST_PREPARING ─► READY ─► ACTIVE ─► EXPIRING ─► ENDED
    │            │               │             │        │  ▲
    ▼            ▼               ▼             ▼        ▼  │ reconectou (≤ 90 s)
CANCELLED    CANCELLED       HOST_FAILED   CANCELLED  INTERRUPTED
                            (estorno total) (timeout)    │ não reconectou
                                                         ▼
                                                    ENDED_EARLY (proporcional)
```

- Em `INTERRUPTED` **por culpa do anfitrião**, o cronômetro pausa (`pausedSeconds`) e `expiresAt` é estendido.
- Em `INTERRUPTED` **por culpa do jogador**, o cronômetro continua.
- A culpa (`faultParty`) é decidida pela telemetria do relay: qual lado caiu primeiro (`ps5LinkUp` × `playerLinkUp`).

### Máquina de estados — liquidação

```
PENDING ─► HOLD (24 h) ─► SETTLED ─► (pago no lote de sexta)
              │
              ▼
          DISPUTED ─► SETTLED | REVERSED
NOT_APPLICABLE: sessões canceladas / estorno total
```

## 4. Ledger de partidas dobradas

Regra: cada `LedgerTransaction` tem entries cuja soma é **zero**. Saldo = soma das entries da conta. Toda transação tem `idempotencyKey` (webhook repetido não credita duas vezes).

| Evento | Entries (centavos) |
|---|---|
| Recarga Pix R$ 50 paga | `EXTERNAL_PIX_IN −5000`, `PLAYER_WALLET +5000` |
| Taxa MP (0,99%) | `PLATFORM_REVENUE −50`, `EXTERNAL_PSP_FEES +50` |
| Compra pacote 1 h | `PLAYER_WALLET −2000`, `PLAYER_HOLD +2000` |
| Captura (sessão completa) | `PLAYER_HOLD −2000`, `HOST_PENDING +1600`, `PLATFORM_REVENUE +400` |
| Liquidação após 24 h | `HOST_PENDING −1600`, `HOST_AVAILABLE +1600` |
| Repasse de sexta | `HOST_AVAILABLE −1600`, `EXTERNAL_PIX_OUT +1600` |

### Captura proporcional (queda por culpa do anfitrião)

Exemplo: pacote 1 h (R$ 20,00), caiu aos 40 min sem reconexão.

```
capturado  = floor(2000 × 2400 / 3600) = 1333   (arredonda a favor do jogador)
anfitrião  = floor(1333 × 8000 / 10000) = 1066
plataforma = 1333 − 1066 = 267                   (plataforma absorve o arredondamento)
devolvido  = 2000 − 1333 = 667 → PLAYER_WALLET
```

Entries: `PLAYER_HOLD −2000`, `HOST_PENDING +1066`, `PLATFORM_REVENUE +267`, `PLAYER_WALLET +667`.

`HOST_FAILED` (nunca ficou jogável): `PLAYER_HOLD −2000`, `PLAYER_WALLET +2000` + `HostStrike`.

## 5. Repasse semanal

- Job de sexta (fuso `America/Sao_Paulo`) cria `PayoutBatch` (`DRAFT`) com o saldo `HOST_AVAILABLE` de cada anfitrião cujas sessões tenham `endedAt ≤ quinta 23:59:59`.
- Anfitrião abaixo de `minPayoutMinor` (R$ 20) fica fora do lote e acumula.
- Anfitrião **suspenso** com disputa aberta: repasse retido até resolver.
- Admin aprova → envio Pix via API Mercado Pago → `Payout.receipt` guarda o comprovante.
- Pix falhou → `PAYOUT_REVERSAL` devolve o valor para `HOST_AVAILABLE`.

## 6. Segurança

- **Credenciais PSN**: envelope encryption (`ConsoleCredential`). Master key em KMS na produção. A web app nunca decifra; só o relay, em memória, durante a sessão.
- **Grants de sessão**: JWT Ed25519 com `sub=sessionId`, `console`, `exp`. O relay valida assinatura e corta no `exp` sem depender do servidor.
- **Filtro de input no relay**: bloqueia botão PS, Create e combinações que abrem menus do sistema. Só passa o controle de jogo.
- **Conta secundária**: limite de gastos zero, comunicação restrita, sem cartão salvo — verificado no checklist do onboarding (`Console.check*`).
- **Webhooks Mercado Pago**: validação de assinatura + `WebhookEvent` único por `(provider, externalId)`.
- **CPF e chave Pix**: cifrados na aplicação; `documentHash` impede contas duplicadas.
- **Auditoria**: `SessionEvent` (toda transição) e `AdminAuditLog` (toda ação de admin).

## 7. Fases

| Fase | Entrega | Critério de saída |
|---|---|---|
| **F0 — Spike do relay** | Ver `docs/SPIKE-RELAY.md` | < 80 ms ponta a ponta, PS5 atrás de CGNAT, corte no exp funcionando |
| **F1 — MVP web** | Login, onboarding do anfitrião + checklist, vitrine + ping, carteira Pix, sessão, player web (gamepad/toque), ledger, reembolso automático, strikes, lote de sexta | 10 anfitriões e 50 sessões reais sem erro de saldo |
| **F2** | USDT, revendedores, novas regiões, agente opcional no PC, reputação, MEI | — |

## 8. Riscos aceitos

- Termos da PSN/Sony: anfitrião pode ter conta ou console banido — explícito nos termos do anfitrião.
- Marca "LeonidaPlay"/GTA: risco de notificação e derrubada de domínio/redes.
- Operação no CPF: tributação sobre o bruto se os repasses não estiverem documentados.
- AGPL do chiaki-ng: o código do relay que linka libchiaki deve ser publicado.
