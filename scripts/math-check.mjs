// Quick sanity check of lib/payoff.ts via type-stripping (node 22+).
import {
  portfolioPnl,
  breakevens,
  extremes,
  settleByCounterparty,
  positions,
} from "../lib/payoff.ts";

const trades = [
  { id: "1", side: "sell", kind: "future", qty: 5, price: 90, counterparty: "Adam", ts: 1 },
  { id: "2", side: "buy", kind: "call", qty: 1, price: 7, strike: 93, counterparty: "Bob", ts: 2 },
];

const checks = [];
const eq = (name, got, want) =>
  checks.push([Math.abs(got - want) < 1e-9 ? "PASS" : `FAIL (got ${got})`, name, want]);

eq("pnl @ 100", portfolioPnl(trades, 100, 1), -50); // futures -50, call breakeven 0
eq("pnl @ 80", portfolioPnl(trades, 80, 1), 43); // futures +50, call -7
eq("pnl @ 93", portfolioPnl(trades, 93, 1), -22); // futures -15, call -7
eq("breakeven", breakevens(trades, 1, 0, 200)[0], 88.6);

const led = settleByCounterparty(trades, 100, 1);
eq("Adam @ 100", led.find((l) => l.counterparty === "Adam").pnl, -50);
eq("Bob @ 100", led.find((l) => l.counterparty === "Bob").pnl, 0);

const ex = extremes(trades, 1);
eq("max profit (S=0)", ex.maxProfit, 443);
console.log("max loss:", ex.maxLoss, "(expect -Infinity: short 5 fut vs long 1 call → net short 4 above 93)");

// straddle: buy 1× 90-straddle at 12
const strad = [{ id: "3", side: "buy", kind: "straddle", qty: 1, price: 12, strike: 90, counterparty: "Cy", ts: 3 }];
eq("straddle @ 90", portfolioPnl(strad, 90, 1), -12);
eq("straddle @ 110", portfolioPnl(strad, 110, 1), 8);
eq("straddle @ 70", portfolioPnl(strad, 70, 1), 8);
const sb = breakevens(strad, 1, 0, 200);
eq("straddle BE low", sb[0], 78);
eq("straddle BE high", sb[1], 102);

console.log(positions(trades));
for (const [status, name, want] of checks) console.log(status.padEnd(18), name, "→", want);
process.exit(checks.some(([s]) => s.startsWith("FAIL")) ? 1 : 0);
