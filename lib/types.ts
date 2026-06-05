export type Side = "buy" | "sell";

/** Instrument kinds. A straddle is a call + put at the same strike, quoted at a combined premium. */
export type Kind = "future" | "call" | "put" | "straddle";

export type OrderSide = "bid" | "offer";

/**
 * A position-building fill expressed from one user's perspective —
 * the shape the payoff math consumes (see lib/payoff.ts).
 */
export interface Trade {
  id: string;
  side: Side;
  kind: Kind;
  qty: number;
  /** Futures price, or option/straddle premium, in event units (pushups). */
  price: number;
  strike?: number;
  /** Display name of who you traded against. */
  counterparty: string;
  note?: string;
  ts: number;
}

/** A listed contract. Created by the admin only; settled by the admin only. */
export interface PitEvent {
  id: string;
  name: string;
  description?: string;
  unit: string;
  tickValue: number;
  /** Final print. null/undefined = market still open. */
  settlement?: number | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

/** A tradable market on an event (the outright future, or a strike). */
export interface Market {
  id: string;
  eventId: string;
  kind: Kind;
  /** Options/straddles only. */
  strike?: number;
  createdBy: string;
  createdAt: number;
}

/** A resting order in a market's ladder. qty is the REMAINING quantity. */
export interface Order {
  id: string;
  marketId: string;
  userId: string;
  side: OrderSide;
  price: number;
  qty: number;
  ts: number;
}

/** One market's book document, stored as a single Redis value. */
export interface BookDoc {
  market: Market;
  orders: Order[];
}

/** An executed transaction between two users. */
export interface Fill {
  id: string;
  eventId: string;
  marketId: string;
  kind: Kind;
  strike?: number;
  price: number;
  qty: number;
  buyerId: string;
  sellerId: string;
  /** Which side the aggressor was on. */
  takerSide: Side;
  ts: number;
}

/** Ticker entry — one per real transaction on the site. */
export interface TapeEntry {
  id: string;
  eventName: string;
  unit: string;
  marketLabel: string;
  price: number;
  qty: number;
  buyerName: string;
  sellerName: string;
  ts: number;
}

export interface EventSummary {
  id: string;
  name: string;
  unit: string;
  tickValue: number;
  marketCount: number;
  fillCount: number;
  settlement?: number | null;
  updatedAt: number;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  isAdmin?: boolean;
}

export const marketLabel = (m: { kind: Kind; strike?: number }): string =>
  m.kind === "future"
    ? "OUTRIGHT"
    : `${m.strike} ${m.kind === "straddle" ? "STRADDLE" : m.kind.toUpperCase()}`;
