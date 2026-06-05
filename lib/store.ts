import { redis, eventKey, userEventsKey } from "./redis";
import type { EventSummary, Kind, PitEvent, Side, Trade } from "./types";

export async function saveEvent(ev: PitEvent): Promise<void> {
  ev.updatedAt = Date.now();
  await redis.set(eventKey(ev.id), JSON.stringify(ev));
  await redis.sadd(userEventsKey(ev.ownerId), ev.id);
}

export async function getEvent(id: string): Promise<PitEvent | null> {
  const raw = await redis.get<PitEvent | string>(eventKey(id));
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as PitEvent) : raw;
}

export async function deleteEvent(ev: PitEvent): Promise<void> {
  await redis.del(eventKey(ev.id));
  await redis.srem(userEventsKey(ev.ownerId), ev.id);
}

export async function listEvents(userId: string): Promise<EventSummary[]> {
  const ids = await redis.smembers(userEventsKey(userId));
  if (!ids || ids.length === 0) return [];
  const events = await Promise.all(ids.map((id) => getEvent(id)));
  const summaries: EventSummary[] = [];
  for (const ev of events) {
    if (!ev) continue;
    summaries.push({
      id: ev.id,
      name: ev.name,
      unit: ev.unit,
      tickValue: ev.tickValue,
      tradeCount: ev.trades.length,
      counterparties: new Set(ev.trades.map((t) => t.counterparty.trim().toLowerCase())).size,
      settlement: ev.settlement,
      updatedAt: ev.updatedAt,
    });
  }
  summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  return summaries;
}

const KINDS: Kind[] = ["future", "call", "put", "straddle"];
const SIDES: Side[] = ["buy", "sell"];

function sanitizeTrade(raw: unknown): Trade | null {
  const o = (raw || {}) as Partial<Trade>;
  if (typeof o.id !== "string" || !o.id) return null;
  const kind = KINDS.includes(o.kind as Kind) ? (o.kind as Kind) : null;
  const side = SIDES.includes(o.side as Side) ? (o.side as Side) : null;
  const qty = Number(o.qty);
  const price = Number(o.price);
  if (!kind || !side || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price)) return null;
  const needsStrike = kind !== "future";
  const strike = Number(o.strike);
  if (needsStrike && !Number.isFinite(strike)) return null;
  return {
    id: o.id,
    kind,
    side,
    qty,
    price,
    strike: needsStrike ? strike : undefined,
    counterparty: String(o.counterparty || "").trim().slice(0, 60),
    note: typeof o.note === "string" ? o.note.slice(0, 200) : undefined,
    ts: Number(o.ts) || Date.now(),
  };
}

/**
 * Light validation/normalisation of a client-supplied event before persisting,
 * so a malformed PUT can't corrupt the store. Preserves ownerId/createdAt from
 * the existing record.
 */
export function sanitizeEvent(incoming: unknown, existing: PitEvent): PitEvent {
  const o = (incoming || {}) as Partial<PitEvent>;
  const trades = Array.isArray(o.trades)
    ? (o.trades.map(sanitizeTrade).filter(Boolean) as Trade[])
    : existing.trades;
  const settlementNum = Number(o.settlement);
  return {
    id: existing.id,
    ownerId: existing.ownerId,
    createdAt: existing.createdAt,
    name: (typeof o.name === "string" && o.name.trim().slice(0, 120)) || existing.name,
    description:
      typeof o.description === "string" ? o.description.slice(0, 500) : existing.description,
    unit: (typeof o.unit === "string" && o.unit.trim().slice(0, 30)) || existing.unit,
    tickValue:
      Number.isFinite(Number(o.tickValue)) && Number(o.tickValue) > 0
        ? Number(o.tickValue)
        : existing.tickValue,
    trades,
    settlement:
      o.settlement === null || o.settlement === undefined
        ? o.settlement === null
          ? null
          : existing.settlement
        : Number.isFinite(settlementNum)
          ? settlementNum
          : existing.settlement,
    updatedAt: Date.now(),
  };
}
