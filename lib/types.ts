export type Side = "buy" | "sell";

/** Instrument kinds. A straddle is a call + put at the same strike, quoted at a combined premium. */
export type Kind = "future" | "call" | "put" | "straddle";

export interface Trade {
  id: string;
  side: Side;
  kind: Kind;
  /** Number of contracts. */
  qty: number;
  /** Futures price, or option/straddle premium, quoted in event units (pushups). */
  price: number;
  /** Strike — options and straddles only. */
  strike?: number;
  /** Who you traded against. */
  counterparty: string;
  note?: string;
  ts: number;
}

export interface PitEvent {
  id: string;
  ownerId: string;
  /** e.g. "John Smith — pushups in 5 minutes" */
  name: string;
  description?: string;
  /** What one unit of price means, e.g. "pushup". */
  unit: string;
  /** Dollars per unit per contract, e.g. 1 → $1/pushup. */
  tickValue: number;
  trades: Trade[];
  /** Final print. null/undefined = market still open. */
  settlement?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface EventSummary {
  id: string;
  name: string;
  unit: string;
  tickValue: number;
  tradeCount: number;
  counterparties: number;
  settlement?: number | null;
  updatedAt: number;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
}
