import type { Kind, Trade } from "./types";

/**
 * Payoff of one contract from the OWNER's perspective, in price units
 * (pushups), at settlement S. Premiums/prices are already netted in.
 */
export function unitPayoff(t: Trade, S: number): number {
  const sign = t.side === "buy" ? 1 : -1;
  const K = t.strike ?? 0;
  let v: number;
  switch (t.kind) {
    case "future":
      v = S - t.price;
      break;
    case "call":
      v = Math.max(S - K, 0) - t.price;
      break;
    case "put":
      v = Math.max(K - S, 0) - t.price;
      break;
    case "straddle":
      v = Math.abs(S - K) - t.price;
      break;
  }
  return sign * v;
}

/** Dollar P&L of a trade at settlement S. */
export function tradePnl(t: Trade, S: number, tickValue: number): number {
  return unitPayoff(t, S) * t.qty * tickValue;
}

/** Total portfolio dollar P&L at settlement S. */
export function portfolioPnl(trades: Trade[], S: number, tickValue: number): number {
  return trades.reduce((acc, t) => acc + tradePnl(t, S, tickValue), 0);
}

/** All x-values where the payoff can kink (strikes), plus reference prices. */
export function kinkXs(trades: Trade[]): number[] {
  const xs = new Set<number>();
  for (const t of trades) {
    if (t.kind === "future") xs.add(t.price);
    else if (t.strike != null) xs.add(t.strike);
  }
  return [...xs].sort((a, b) => a - b);
}

/** Sensible x-domain for the chart: [0, beyond the action]. Pushups can't go negative. */
export function chartDomain(trades: Trade[]): [number, number] {
  const xs = kinkXs(trades);
  if (xs.length === 0) return [0, 100];
  const lo = xs[0];
  const hi = xs[xs.length - 1];
  const span = Math.max(hi - lo, hi * 0.25, 10);
  return [Math.max(0, Math.floor(lo - span * 0.45)), Math.ceil(hi + span * 0.45)];
}

/** Breakeven settlement prices within [lo, hi] (payoff is piecewise linear). */
export function breakevens(trades: Trade[], tickValue: number, lo: number, hi: number): number[] {
  if (trades.length === 0) return [];
  const xs = [lo, ...kinkXs(trades).filter((x) => x > lo && x < hi), hi];
  const out: number[] = [];
  const f = (x: number) => portfolioPnl(trades, x, tickValue);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    const fa = f(a);
    const fb = f(b);
    if (fa === 0) out.push(a);
    if (fa * fb < 0) out.push(a + ((b - a) * -fa) / (fb - fa));
  }
  const fLast = f(xs[xs.length - 1]);
  if (fLast === 0) out.push(xs[xs.length - 1]);
  // de-dup near-equal roots
  return out.filter((x, i) => i === 0 || Math.abs(x - out[i - 1]) > 1e-9);
}

/** Slope of total dollar P&L per unit, just above the right edge / below the left edge. */
export function tailSlopes(trades: Trade[], tickValue: number, lo: number, hi: number) {
  const f = (x: number) => portfolioPnl(trades, x, tickValue);
  const eps = 1e-6;
  return {
    leftSlope: (f(lo + eps) - f(lo)) / eps,
    rightSlope: (f(hi) - f(hi - eps)) / eps,
  };
}

/** Max profit / max loss over [lo, ∞) style domain; Infinity when unbounded. */
export function extremes(trades: Trade[], tickValue: number) {
  if (trades.length === 0) return { maxProfit: 0, maxLoss: 0 };
  const xs = kinkXs(trades);
  const lo = 0;
  const hi = (xs[xs.length - 1] ?? 0) + 1;
  const candidates = [lo, ...xs.filter((x) => x > lo)];
  const f = (x: number) => portfolioPnl(trades, x, tickValue);
  let maxProfit = -Infinity;
  let maxLoss = Infinity;
  for (const x of candidates) {
    const v = f(x);
    if (v > maxProfit) maxProfit = v;
    if (v < maxLoss) maxLoss = v;
  }
  const { rightSlope } = tailSlopes(trades, tickValue, lo, hi);
  if (rightSlope > 1e-9) maxProfit = Infinity;
  if (rightSlope < -1e-9) maxLoss = -Infinity;
  return { maxProfit, maxLoss };
}

export interface CounterpartyLedger {
  counterparty: string;
  pnl: number; // + means they owe you
  trades: { trade: Trade; pnl: number }[];
}

/** Who owes whom at settlement S, grouped by counterparty. */
export function settleByCounterparty(
  trades: Trade[],
  S: number,
  tickValue: number
): CounterpartyLedger[] {
  const map = new Map<string, CounterpartyLedger>();
  for (const t of trades) {
    const key = t.counterparty.trim() || "(unknown)";
    let entry = map.get(key.toLowerCase());
    if (!entry) {
      entry = { counterparty: key, pnl: 0, trades: [] };
      map.set(key.toLowerCase(), entry);
    }
    const pnl = tradePnl(t, S, tickValue);
    entry.pnl += pnl;
    entry.trades.push({ trade: t, pnl });
  }
  return [...map.values()].sort((a, b) => b.pnl - a.pnl);
}

export interface PositionLine {
  kind: Kind;
  strike?: number;
  netQty: number; // + long, - short
  avgPrice: number;
}

/** Net position per instrument (futures, and per-strike calls/puts/straddles). */
export function positions(trades: Trade[]): PositionLine[] {
  const map = new Map<string, { kind: Kind; strike?: number; qty: number; signedCost: number }>();
  for (const t of trades) {
    const key = t.kind === "future" ? "future" : `${t.kind}:${t.strike}`;
    let e = map.get(key);
    if (!e) {
      e = { kind: t.kind, strike: t.kind === "future" ? undefined : t.strike, qty: 0, signedCost: 0 };
      map.set(key, e);
    }
    const signed = t.side === "buy" ? t.qty : -t.qty;
    e.qty += signed;
    e.signedCost += signed * t.price;
  }
  const order: Record<Kind, number> = { future: 0, call: 1, put: 2, straddle: 3 };
  return [...map.values()]
    .filter((e) => e.qty !== 0)
    .map((e) => ({
      kind: e.kind,
      strike: e.strike,
      netQty: e.qty,
      avgPrice: e.signedCost / e.qty,
    }))
    .sort((a, b) => order[a.kind] - order[b.kind] || (a.strike ?? 0) - (b.strike ?? 0));
}

export const fmtMoney = (v: number): string => {
  if (v === Infinity) return "UNLIMITED";
  if (v === -Infinity) return "UNLIMITED";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const s = abs >= 1000 ? abs.toLocaleString("en-US", { maximumFractionDigits: 2 }) : abs.toFixed(2).replace(/\.00$/, "");
  return `${sign}$${s}`;
};

export const fmtNum = (v: number): string =>
  Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
