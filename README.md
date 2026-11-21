# LeonidaPlay

Marketplace P2P de cloud gaming para PS5 — jogue GTA 6 Online sem console, ou ganhe dinheiro alugando o seu.

> **Status:** F0 (spike do relay). Leia `docs/ARQUITETURA.md` e `docs/SPIKE-RELAY.md`.

## Estrutura

```
apps/web/          Next.js (App Router) — UI PT/EN, carteira Pix, vitrine, admin   [F1]
services/relay/    Go + Pion + libchiaki — ponte PS5 → WebRTC                       [F0]
packages/db/       Prisma 7 + Postgres — schema, migrations, seed
packages/ledger/   Regras de dinheiro (ledger de partidas dobradas, rateio 80/20)    [F1]
docs/              Arquitetura, decisões e roteiro do spike
```

## Banco de dados

```bash
cp .env.example .env              # preencha DATABASE_URL
npm install
npm run db:validate
npx -w @leonidaplay/db prisma migrate deploy
npm run db:seed                   # região BR-SP + pacotes + contas de sistema
```

## Preços (região BR-SP, split 80/20)

| Pacote | Preço | Anfitrião | Plataforma |
|---|---|---|---|
| 15 min | R$ 7,50 | R$ 6,00 | R$ 1,50 |
| 30 min | R$ 12,50 | R$ 10,00 | R$ 2,50 |
| 1 h | R$ 20,00 | R$ 16,00 | R$ 4,00 |
| 3 h | R$ 50,00 | R$ 40,00 | R$ 10,00 |
