import { v4 as uuid } from "uuid";
import { getUserById } from "./auth";
import { sendEmail } from "./email";
import {
  eventFillsKey,
  eventKey,
  eventMarketsKey,
  eventsKey,
  marketKey,
  redis,
  tapeKey,
} from "./redis";
import {
  marketLabel,
  type BookDoc,
  type EventSummary,
  type Fill,
  type Kind,
  type Market,
  type Order,
  type OrderSide,
  type PitEvent,
  type TapeEntry,
} from "./types";

function parse<T>(raw: T | string | null): T | null {
  if (raw == null) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as T) : (raw as T);
}

/* ── events ─────────────────────────────────────────────────── */

export async function getEvent(id: string): Promise<PitEvent | null> {
  return parse<PitEvent>(await redis.get(eventKey(id)));
}

export async function saveEvent(ev: PitEvent): Promise<void> {
  ev.updatedAt = Date.now();
  await redis.set(eventKey(ev.id), JSON.stringify(ev));
  await redis.sadd(eventsKey(), ev.id);
}

export async function createEvent(opts: {
  name: string;
  description?: string;
  unit: string;
  tickValue: number;
  createdBy: string;
}): Promise<PitEvent> {
  const now = Date.now();
  const ev: PitEvent = {
    id: uuid(),
    name: opts.name,
    description: opts.description,
    unit: opts.unit,
    tickValue: opts.tickValue,
    settlement: undefined,
    createdBy: opts.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  await saveEvent(ev);
  // Every event gets the outright market by default; users register strikes.
  await createMarket(ev.id, "future", undefined, opts.createdBy);
  return ev;
}

export async function deleteEvent(id: string): Promise<void> {
  const marketIds = await redis.smembers(eventMarketsKey(id));
  if (marketIds?.length) {
    await Promise.all(marketIds.map((m) => redis.del(marketKey(m))));
  }
  await redis.del(eventMarketsKey(id));
  await redis.del(eventFillsKey(id));
  await redis.del(eventKey(id));
  await redis.srem(eventsKey(), id);
}

export async function listEvents(): Promise<EventSummary[]> {
  const ids = await redis.smembers(eventsKey());
  if (!ids || ids.length === 0) return [];
  const events = await Promise.all(ids.map((id) => getEvent(id)));
  const summaries: EventSummary[] = [];
  for (const ev of events) {
    if (!ev) continue;
    const [marketCount, fillCount] = await Promise.all([
      redis.scard(eventMarketsKey(ev.id)),
      redis.llen(eventFillsKey(ev.id)),
    ]);
    summaries.push({
      id: ev.id,
      name: ev.name,
      unit: ev.unit,
      tickValue: ev.tickValue,
      marketCount: marketCount ?? 0,
      fillCount: fillCount ?? 0,
      settlement: ev.settlement,
      updatedAt: ev.updatedAt,
    });
  }
  summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  return summaries;
}

/* ── markets ────────────────────────────────────────────────── */

export async function getBook(marketId: string): Promise<BookDoc | null> {
  return parse<BookDoc>(await redis.get(marketKey(marketId)));
}

async function saveBook(book: BookDoc): Promise<void> {
  await redis.set(marketKey(book.market.id), JSON.stringify(book));
}

export async function listBooks(eventId: string): Promise<BookDoc[]> {
  const ids = await redis.smembers(eventMarketsKey(eventId));
  if (!ids || ids.length === 0) return [];
  const books = (await Promise.all(ids.map((id) => getBook(id)))).filter(Boolean) as BookDoc[];
  const order: Record<Kind, number> = { future: 0, call: 1, put: 2, straddle: 3 };
  books.sort(
    (a, b) =>
      order[a.market.kind] - order[b.market.kind] ||
      (a.market.strike ?? 0) - (b.market.strike ?? 0)
  );
  return books;
}

export interface SeedQuote {
  bidPrice: number;
  bidQty: number;
  offerPrice: number;
  offerQty: number;
}

/** Market-maker obligation for new derivative markets. */
export const SEED_MIN_QTY = 5;
export const SEED_MAX_WIDTH = 5;

export async function createMarket(
  eventId: string,
  kind: Kind,
  strike: number | undefined,
  createdBy: string,
  seed?: SeedQuote
): Promise<Market | { error: string }> {
  if (kind !== "future" && (strike == null || !Number.isFinite(strike))) {
    return { error: "A strike is required." };
  }
  // Listing a derivative means making a market: ≥5 up on each side, ≤5 wide.
  if (kind !== "future") {
    if (!seed) return { error: "New markets need an opening quote." };
    const { bidPrice, bidQty, offerPrice, offerQty } = seed;
    if (![bidPrice, bidQty, offerPrice, offerQty].every(Number.isFinite)) {
      return { error: "Fill in the whole opening quote." };
    }
    if (bidQty < SEED_MIN_QTY || offerQty < SEED_MIN_QTY) {
      return { error: `Quote at least ${SEED_MIN_QTY} lots on each side.` };
    }
    if (bidPrice < 0 || offerPrice <= bidPrice) {
      return { error: "The offer must be above the bid." };
    }
    if (offerPrice - bidPrice > SEED_MAX_WIDTH) {
      return { error: `Max ${SEED_MAX_WIDTH} wide — tighten it up.` };
    }
  }
  const existing = await listBooks(eventId);
  if (
    existing.some(
      (b) => b.market.kind === kind && (kind === "future" || b.market.strike === strike)
    )
  ) {
    return { error: "That market is already listed." };
  }
  const market: Market = {
    id: uuid(),
    eventId,
    kind,
    strike: kind === "future" ? undefined : strike,
    createdBy,
    createdAt: Date.now(),
  };
  const now = Date.now();
  const orders: Order[] = seed
    ? [
        { id: uuid(), marketId: market.id, userId: createdBy, side: "bid", price: seed.bidPrice, qty: seed.bidQty, ts: now },
        { id: uuid(), marketId: market.id, userId: createdBy, side: "offer", price: seed.offerPrice, qty: seed.offerQty, ts: now },
      ]
    : [];
  await saveBook({ market, orders });
  await redis.sadd(eventMarketsKey(eventId), market.id);
  return market;
}

/* ── fills + tape ───────────────────────────────────────────── */

export async function listFills(eventId: string, limit = 300): Promise<Fill[]> {
  const raw = await redis.lrange(eventFillsKey(eventId), 0, limit - 1);
  return (raw || []).map((r) => parse<Fill>(r)!).filter(Boolean);
}

export async function listTape(limit = 30): Promise<TapeEntry[]> {
  const raw = await redis.lrange(tapeKey(), 0, limit - 1);
  return (raw || []).map((r) => parse<TapeEntry>(r)!).filter(Boolean);
}

/* ── matching engine ────────────────────────────────────────── */

export interface PlaceResult {
  fills: Fill[];
  resting: Order | null;
  error?: string;
}

/**
 * Place an order into a market's ladder with price-time priority matching.
 * A bid matches offers priced at or below it; an offer matches bids at or
 * above it. Self-matching is skipped (your own resting orders are left
 * alone). Any remainder rests in the book.
 *
 * Office-scale concurrency note: this is a read-modify-write on one Redis
 * key; simultaneous orders in the same market could race. Fine for a pit
 * of friends, not for the CME.
 */
export async function placeOrder(
  marketId: string,
  userId: string,
  side: OrderSide,
  price: number,
  qty: number
): Promise<PlaceResult> {
  const book = await getBook(marketId);
  if (!book) return { fills: [], resting: null, error: "Market not found." };

  const ev = await getEvent(book.market.eventId);
  if (!ev) return { fills: [], resting: null, error: "Event not found." };
  if (ev.settlement != null)
    return { fills: [], resting: null, error: "Market is settled — trading is closed." };

  let remaining = qty;
  const fills: Fill[] = [];
  const isBid = side === "bid";

  // counterparty queue: best price first, then time priority
  const resting = book.orders
    .filter((o) => o.side !== side && o.userId !== userId)
    .sort((a, b) => (isBid ? a.price - b.price : b.price - a.price) || a.ts - b.ts);

  for (const o of resting) {
    if (remaining <= 0) break;
    const crosses = isBid ? o.price <= price : o.price >= price;
    if (!crosses) break;
    const tradeQty = Math.min(remaining, o.qty);
    fills.push({
      id: uuid(),
      eventId: ev.id,
      marketId,
      kind: book.market.kind,
      strike: book.market.strike,
      price: o.price, // trades at the resting order's price
      qty: tradeQty,
      buyerId: isBid ? userId : o.userId,
      sellerId: isBid ? o.userId : userId,
      takerSide: isBid ? "buy" : "sell",
      ts: Date.now(),
    });
    o.qty -= tradeQty;
    remaining -= tradeQty;
  }

  book.orders = book.orders.filter((o) => o.qty > 0);

  let restingOrder: Order | null = null;
  if (remaining > 0) {
    // merge with an existing order at the same price/side (preserves queue priority)
    const existing = book.orders.find(
      (o) => o.userId === userId && o.side === side && o.price === price
    );
    if (existing) {
      existing.qty += remaining;
      restingOrder = existing;
    } else {
      restingOrder = {
        id: uuid(),
        marketId,
        userId,
        side,
        price,
        qty: remaining,
        ts: Date.now(),
      };
      book.orders.push(restingOrder);
    }
  }

  await saveBook(book);

  if (fills.length > 0) {
    await recordFills(ev, book.market, fills);
  }

  return { fills, resting: restingOrder };
}

export async function cancelOrder(
  marketId: string,
  orderId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const book = await getBook(marketId);
  if (!book) return { ok: false, error: "Market not found." };
  const order = book.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "Order already gone." };
  if (order.userId !== userId) return { ok: false, error: "Not your order." };
  book.orders = book.orders.filter((o) => o.id !== orderId);
  await saveBook(book);
  return { ok: true };
}

/* ── fill bookkeeping: event tape, global ticker, emails ────── */

async function recordFills(ev: PitEvent, market: Market, fills: Fill[]): Promise<void> {
  const userIds = [...new Set(fills.flatMap((f) => [f.buyerId, f.sellerId]))];
  const users = new Map(
    (await Promise.all(userIds.map(async (id) => [id, await getUserById(id)] as const))).filter(
      ([, u]) => u
    )
  );
  const nameOf = (id: string) => users.get(id)?.displayName || "unknown";

  for (const f of fills) {
    await redis.lpush(eventFillsKey(ev.id), JSON.stringify(f));
    const tape: TapeEntry = {
      id: f.id,
      eventName: ev.name,
      unit: ev.unit,
      marketLabel: marketLabel(market),
      price: f.price,
      qty: f.qty,
      buyerName: nameOf(f.buyerId),
      sellerName: nameOf(f.sellerId),
      ts: f.ts,
    };
    await redis.lpush(tapeKey(), JSON.stringify(tape));
  }
  await redis.ltrim(tapeKey(), 0, 49);

  // TRADE NOTIFICATION to both counterparties, per fill
  await Promise.all(
    fills.flatMap((f) => {
      const label = marketLabel(market);
      const when = new Date(f.ts).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      return (["buyer", "seller"] as const).map((role) => {
        const me = role === "buyer" ? f.buyerId : f.sellerId;
        const them = role === "buyer" ? f.sellerId : f.buyerId;
        const user = users.get(me);
        if (!user) return Promise.resolve({ delivered: false });
        const verb = role === "buyer" ? "BOUGHT" : "SOLD";
        const line = `You ${verb} ${f.qty} × ${label} @ ${f.price} ${role === "buyer" ? "from" : "to"} ${nameOf(them)}`;
        const subject = `TRADE NOTIFICATION — ${verb} ${f.qty} ${label} @ ${f.price} · ${ev.name}`;
        const text = [
          "PUSHUP PIT — TRADE NOTIFICATION",
          "",
          line,
          `Contract: ${ev.name}`,
          `Tick value: $${ev.tickValue} per ${ev.unit}`,
          `Time: ${when}`,
          "",
          `Review your exposure: https://pushups.grannis.xyz/pit/${ev.id}`,
        ].join("\n");
        const html = `
          <div style="font-family:Georgia,serif;background:#0d2118;color:#f3ead7;padding:24px;border-radius:8px">
            <div style="font-size:11px;letter-spacing:3px;color:#e3b04e">PUSHUP PIT — TRADE NOTIFICATION</div>
            <h2 style="font-family:Georgia,serif;letter-spacing:1px;margin:12px 0">${line}</h2>
            <table style="color:#f3ead7;font-family:monospace;font-size:13px">
              <tr><td style="padding-right:16px;opacity:.6">Contract</td><td>${ev.name}</td></tr>
              <tr><td style="padding-right:16px;opacity:.6">Tick value</td><td>$${ev.tickValue} per ${ev.unit}</td></tr>
              <tr><td style="padding-right:16px;opacity:.6">Time</td><td>${when}</td></tr>
            </table>
            <p style="margin-top:18px"><a href="https://pushups.grannis.xyz/pit/${ev.id}" style="color:#e3b04e">Review your exposure →</a></p>
          </div>`;
        return sendEmail({ to: user.email, subject, html, text });
      });
    })
  );
}

/* ── display-name resolution for API payloads ───────────────── */

export async function resolveNames(userIds: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(userIds)];
  const out: Record<string, string> = {};
  await Promise.all(
    unique.map(async (id) => {
      const u = await getUserById(id);
      out[id] = u?.displayName || "unknown";
    })
  );
  return out;
}
