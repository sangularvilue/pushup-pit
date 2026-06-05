# PUSHUP PIT

The push-up derivatives exchange — live at **pushups.grannis.xyz**.

List a contract on anything countable ("pushups John Smith does in 5 minutes"),
set the tick value ($/pushup), then trade **futures, calls, puts and straddles**
against named counterparties. A live payoff diagram shows portfolio P&L at every
possible settlement (breakevens, max profit/loss, per-counterparty lines). Enter
the final count to "ring the bell" and the reckoning prints who owes whom, per
trade and per counterparty.

## Stack

- Next.js 15 (App Router) + React 19, plain CSS (no Tailwind)
- Upstash Redis (shared grannis.xyz instance, keys under `pushups:`)
- jose JWT cookie sessions + scrypt password hashing (same pattern as wedding-tables)

## Payoff conventions

Prices and premiums are quoted in event units (pushups). Dollar P&L =
unit payoff × qty × tickValue, always from the account owner's perspective.

- Future: `±(S − price)`
- Call: `±(max(S − K, 0) − premium)`
- Put: `±(max(K − S, 0) − premium)`
- Straddle: `±(|S − K| − premium)`

## Dev

```
npm install
npm run dev
```

Requires `.env.local` with `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
`AUTH_SECRET`.

## Deploy

Vercel project + `pushups.grannis.xyz` A record → 76.76.21.21 (DNS only).
