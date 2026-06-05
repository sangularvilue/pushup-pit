"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BrandMark from "./BrandMark";
import Ladder from "./Ladder";
import PayoffChart from "./PayoffChart";
import Ticker from "./Ticker";
import ViewTweaks from "./ViewTweaks";
import {
  chartDomain,
  extremes,
  fmtMoney,
  fmtNum,
  positions,
  settleByCounterparty,
} from "@/lib/payoff";
import {
  marketLabel,
  type BookDoc,
  type Fill,
  type Kind,
  type OrderSide,
  type PitEvent,
  type Trade,
} from "@/lib/types";

interface Bundle {
  event: PitEvent;
  books: BookDoc[];
  fills: Fill[];
  names: Record<string, string>;
  me: string;
  isAdmin: boolean;
}

function pnlClass(v: number): string {
  return v > 0.005 ? "pos" : v < -0.005 ? "neg" : "flat";
}

export default function EventDesk({
  id,
  displayName,
}: {
  id: string;
  displayName: string;
}) {
  const router = useRouter();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [flash, setFlash] = useState("");

  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [mktKind, setMktKind] = useState<Kind>("call");
  const [mktStrike, setMktStrike] = useState("");
  const [mktErr, setMktErr] = useState("");
  const [whatIfStr, setWhatIfStr] = useState("");
  const [settleStr, setSettleStr] = useState("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/events/${id}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to load.");
      setBundle(data);
      setLoadErr("");
    } catch (e) {
      setLoadErr(String((e as Error).message || e));
    }
  }, [id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const event = bundle?.event ?? null;
  const books = useMemo(() => bundle?.books ?? [], [bundle]);
  const fills = useMemo(() => bundle?.fills ?? [], [bundle]);
  const names = useMemo(() => bundle?.names ?? {}, [bundle]);
  const me = bundle?.me ?? "";
  const isAdmin = bundle?.isAdmin ?? false;
  const settled = event?.settlement != null;
  const tickValue = event?.tickValue ?? 1;
  const unit = event?.unit ?? "pushup";

  const selectedBook =
    books.find((b) => b.market.id === selectedMarketId) ?? books[0] ?? null;

  /* my fills, in the shape the payoff math eats */
  const myTrades = useMemo<Trade[]>(
    () =>
      fills
        .filter((f) => f.buyerId === me || f.sellerId === me)
        .map((f) => ({
          id: f.id,
          side: f.buyerId === me ? ("buy" as const) : ("sell" as const),
          kind: f.kind,
          strike: f.strike,
          qty: f.qty,
          price: f.price,
          counterparty: names[f.buyerId === me ? f.sellerId : f.buyerId] || "unknown",
          ts: f.ts,
        })),
    [fills, me, names]
  );

  const whatIf = whatIfStr.trim() === "" ? null : Number(whatIfStr);
  const validWhatIf = whatIf != null && Number.isFinite(whatIf) ? whatIf : null;
  const markPrice = settled ? event!.settlement! : validWhatIf;

  const { maxProfit, maxLoss } = useMemo(() => extremes(myTrades, tickValue), [myTrades, tickValue]);
  const posLines = useMemo(() => positions(myTrades), [myTrades]);
  const ledger = useMemo(
    () => (markPrice != null ? settleByCounterparty(myTrades, markPrice, tickValue) : []),
    [myTrades, markPrice, tickValue]
  );
  const totalAtMark = ledger.reduce((a, l) => a + l.pnl, 0);
  const [domLo, domHi] = useMemo(() => chartDomain(myTrades), [myTrades]);
  const sliderMin = Math.max(0, domLo);

  const lastPriceByMarket = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = fills.length - 1; i >= 0; i--) m.set(fills[i].marketId, fills[i].price);
    return m;
  }, [fills]);

  if (loadErr && !bundle) {
    return (
      <div className="shell">
        <p className="error-text">{loadErr}</p>
        <Link href="/pit">← Back to the floor</Link>
      </div>
    );
  }
  if (!event) {
    return (
      <div className="shell">
        <p className="mono-sub">Opening the pit…</p>
      </div>
    );
  }

  function showFlash(msg: string) {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(""), 5000);
  }

  async function act(fn: () => Promise<Response>): Promise<unknown | null> {
    setBusy(true);
    setActionErr("");
    try {
      const r = await fn();
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || "Request failed.");
      await refresh();
      return data;
    } catch (e) {
      setActionErr(String((e as Error).message || e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder(side: OrderSide, price: number, qty: number) {
    if (!selectedBook) return;
    const data = (await act(() =>
      fetch(`/api/markets/${selectedBook.market.id}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side, price, qty }),
      })
    )) as { fills?: Fill[] } | null;
    if (data?.fills?.length) {
      const traded = data.fills.reduce((a, f) => a + f.qty, 0);
      const avg = data.fills.reduce((a, f) => a + f.price * f.qty, 0) / traded;
      showFlash(
        `FILLED — ${side === "bid" ? "bought" : "sold"} ${fmtNum(traded)} × ${marketLabel(selectedBook.market)} @ ${fmtNum(Math.round(avg * 100) / 100)}. Confirmation emails sent.`
      );
    }
  }

  function cancelOrder(orderId: string) {
    if (!selectedBook) return;
    act(() => fetch(`/api/markets/${selectedBook.market.id}/orders/${orderId}`, { method: "DELETE" }));
  }

  async function registerMarket(e: React.FormEvent) {
    e.preventDefault();
    setMktErr("");
    const strike = Number(mktStrike);
    if (!Number.isFinite(strike)) return setMktErr("Enter a strike.");
    const data = (await act(() =>
      fetch(`/api/events/${id}/markets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: mktKind, strike }),
      })
    )) as { market?: { id: string } } | null;
    if (data?.market) {
      setSelectedMarketId(data.market.id);
      setMktStrike("");
    } else if (actionErr) {
      setMktErr(actionErr);
    }
  }

  function ringTheBell(e: React.FormEvent) {
    e.preventDefault();
    const s = Number(settleStr);
    if (!Number.isFinite(s)) return;
    act(() =>
      fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlement: s }),
      })
    );
  }

  function reopen() {
    setSettleStr(event!.settlement != null ? String(event!.settlement) : "");
    act(() =>
      fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlement: null }),
      })
    );
  }

  async function delist() {
    if (!confirm(`Delist "${event!.name}", all markets and all trades? This can't be undone.`)) return;
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    router.push("/pit");
  }

  const bbo = (b: BookDoc) => {
    const bids = b.orders.filter((o) => o.side === "bid").map((o) => o.price);
    const offers = b.orders.filter((o) => o.side === "offer").map((o) => o.price);
    const bb = bids.length ? Math.max(...bids) : null;
    const bo = offers.length ? Math.min(...offers) : null;
    return `${bb != null ? fmtNum(bb) : "—"} / ${bo != null ? fmtNum(bo) : "—"}`;
  };

  const myOpenOrders = books.flatMap((b) => b.orders.filter((o) => o.userId === me));

  return (
    <>
      <Ticker />
      <header className="site-header">
        <Link href="/pit" className="brand">
          <BrandMark />
          PUSHUP<span className="accent">PIT</span>
        </Link>
        <div className="header-center">
          <div className="crumb">
            <Link href="/pit" style={{ color: "inherit" }}>
              ← trading floor
            </Link>
          </div>
          <div className="event-name">{event.name}</div>
        </div>
        <div className="header-right">
          <span className="mono-sub" style={{ fontSize: 12 }}>
            ${fmtNum(tickValue)}/{unit} · badge:{" "}
            <strong style={{ color: "var(--chalk)" }}>{displayName}</strong>
            {isAdmin && " · OPERATOR"}
          </span>
          <span className={`badge ${settled ? "badge-settled" : "badge-open"}`}>
            {settled ? `Settled · ${fmtNum(event.settlement!)}` : "Market open"}
          </span>
          <ViewTweaks />
        </div>
      </header>
      <main>
        <div className="shell">
          {settled && (
            <div className="settled-banner">
              <span className="big">🔔 Final print: {fmtNum(event.settlement!)} {unit}s</span>
              <span className="num">
                Your book:{" "}
                <span className={pnlClass(totalAtMark)}>
                  {totalAtMark >= 0 ? "+" : ""}
                  {fmtMoney(totalAtMark)}
                </span>
              </span>
              {isAdmin && (
                <button className="btn btn-ink" onClick={reopen}>
                  Reopen market
                </button>
              )}
            </div>
          )}

          {flash && (
            <div
              className="num"
              style={{
                border: "1.5px solid var(--up)",
                borderRadius: 4,
                padding: "8px 14px",
                color: "var(--up)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {flash}
            </div>
          )}
          {actionErr && <div className="error-text">{actionErr}</div>}

          <div className="desk-grid">
            {/* ── LEFT: markets, register, admin desk ─────────── */}
            <div className="desk-col">
              <div className="panel">
                <div className="panel-head">
                  <span className="panel-title">Markets</span>
                  <span className="subtle">{books.length} listed</span>
                </div>
                <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {books.map((b) => {
                    const last = lastPriceByMarket.get(b.market.id);
                    const isSel = selectedBook?.market.id === b.market.id;
                    return (
                      <button
                        key={b.market.id}
                        className={`market-row${isSel ? " selected" : ""}`}
                        onClick={() => setSelectedMarketId(b.market.id)}
                      >
                        <span className="lbl">{marketLabel(b.market)}</span>
                        <span className="bbo">
                          {bbo(b)}
                          {last != null && <span style={{ color: "var(--brass)" }}> · last {fmtNum(last)}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {!settled && (
                <form className="ticket" onSubmit={registerMarket}>
                  <div className="ticket-head">
                    <span className="ticket-title">Register a Market</span>
                  </div>
                  <div className="ticket-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="form-row">
                      <div className="field">
                        <label className="flabel">Derivative</label>
                        <select className="finput" value={mktKind} onChange={(e) => setMktKind(e.target.value as Kind)}>
                          <option value="call">Call</option>
                          <option value="put">Put</option>
                          <option value="straddle">Straddle</option>
                        </select>
                      </div>
                      <div className="field">
                        <label className="flabel">Strike</label>
                        <input
                          className="finput"
                          inputMode="decimal"
                          placeholder="93"
                          value={mktStrike}
                          onChange={(e) => setMktStrike(e.target.value)}
                        />
                      </div>
                    </div>
                    {mktErr && <div className="error-text">{mktErr}</div>}
                    <button type="submit" className="btn btn-ink" disabled={busy}>
                      List it
                    </button>
                  </div>
                </form>
              )}

              <div className="panel">
                <div className="panel-head">
                  <span className="panel-title">My Position</span>
                </div>
                <div className="panel-body">
                  {posLines.length === 0 ? (
                    <div className="empty-note">Flat. For now.</div>
                  ) : (
                    <table className="blotter">
                      <tbody>
                        {posLines.map((p, i) => (
                          <tr key={i}>
                            <td className={p.netQty > 0 ? "pos" : "neg"} style={{ fontWeight: 600 }}>
                              {p.netQty > 0 ? `+${fmtNum(p.netQty)}` : fmtNum(p.netQty)}
                            </td>
                            <td>
                              {p.kind === "future"
                                ? "OUTRIGHT"
                                : `${fmtNum(p.strike ?? 0)} ${p.kind.toUpperCase()}${Math.abs(p.netQty) !== 1 ? "S" : ""}`}
                            </td>
                            <td className="r" style={{ color: "var(--chalk-dim)" }}>
                              avg {fmtNum(Math.round(p.avgPrice * 100) / 100)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {myOpenOrders.length > 0 && (
                    <div className="mono-sub" style={{ marginTop: 10, fontSize: 11.5 }}>
                      {myOpenOrders.length} working order{myOpenOrders.length === 1 ? "" : "s"} (✕ them in the
                      ladder)
                    </div>
                  )}
                </div>
              </div>

              {isAdmin && !settled && (
                <div className="panel">
                  <div className="panel-head">
                    <span className="panel-title">Operator Desk</span>
                    <span className="subtle">only you see this</span>
                  </div>
                  <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <form onSubmit={ringTheBell} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                      <div className="field" style={{ width: 130 }}>
                        <label className="flabel">Final print</label>
                        <input
                          className="finput"
                          inputMode="decimal"
                          placeholder="official count"
                          value={settleStr}
                          onChange={(e) => setSettleStr(e.target.value)}
                        />
                      </div>
                      <button
                        type="submit"
                        className="btn btn-gold"
                        disabled={busy || settleStr.trim() === "" || !Number.isFinite(Number(settleStr))}
                      >
                        🔔 Ring the bell
                      </button>
                    </form>
                    <button className="del-btn" style={{ alignSelf: "flex-start" }} onClick={delist}>
                      ✕ delist event
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT: ladder, exposure, reckoning, tape ────── */}
            <div className="desk-col">
              {selectedBook && (
                <div className="panel">
                  <div className="panel-head">
                    <span className="panel-title">
                      Ladder — {marketLabel(selectedBook.market)}
                    </span>
                    <span className="subtle">
                      {settled ? "trading closed" : "click a level to bid or offer it"}
                    </span>
                  </div>
                  <div className="panel-body">
                    <Ladder
                      book={selectedBook}
                      names={names}
                      me={me}
                      disabled={settled}
                      lastPrice={lastPriceByMarket.get(selectedBook.market.id) ?? null}
                      busy={busy}
                      onOrder={placeOrder}
                      onCancel={cancelOrder}
                    />
                  </div>
                </div>
              )}

              <div className="panel chart-panel">
                <div className="panel-head">
                  <span className="panel-title">My Exposure at Settlement</span>
                  {!settled && (
                    <span className="mono-sub" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      what-if
                      <input
                        className="finput"
                        style={{ width: 80, padding: "3px 6px", fontSize: 12 }}
                        inputMode="decimal"
                        placeholder="87"
                        value={whatIfStr}
                        onChange={(e) => setWhatIfStr(e.target.value)}
                      />
                    </span>
                  )}
                </div>
                <div className="panel-body" style={{ paddingTop: 8 }}>
                  <PayoffChart
                    trades={myTrades}
                    tickValue={tickValue}
                    unit={unit}
                    settlement={settled ? event.settlement : null}
                    whatIf={settled ? null : validWhatIf}
                  />
                  {!settled && myTrades.length > 0 && (
                    <input
                      type="range"
                      className="pit-range"
                      min={sliderMin}
                      max={domHi}
                      step={(domHi - sliderMin) / 200 || 1}
                      value={validWhatIf ?? sliderMin}
                      onChange={(e) => setWhatIfStr(e.target.value)}
                      style={{ width: "100%", marginTop: 10 }}
                    />
                  )}
                </div>
              </div>

              <div className="stat-row">
                <div className="stat">
                  <div className="stat-label">Max profit</div>
                  <div className={`stat-value ${maxProfit === Infinity ? "pos" : pnlClass(maxProfit)}`}>
                    {myTrades.length ? fmtMoney(maxProfit) : "—"}
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">Max loss</div>
                  <div className={`stat-value ${maxLoss === -Infinity ? "neg" : pnlClass(maxLoss)}`}>
                    {myTrades.length ? fmtMoney(maxLoss) : "—"}
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">My trades</div>
                  <div className="stat-value" style={{ color: "var(--brass)" }}>
                    {myTrades.length}
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">{settled ? "P&L at settle" : "P&L at what-if"}</div>
                  <div className={`stat-value ${markPrice != null ? pnlClass(totalAtMark) : "flat"}`}>
                    {markPrice != null ? `${totalAtMark >= 0 ? "+" : ""}${fmtMoney(totalAtMark)}` : "—"}
                  </div>
                </div>
              </div>

              {markPrice != null && ledger.length > 0 && (
                <div className="panel">
                  <div className="panel-head">
                    <span className="panel-title">
                      {settled ? "The Reckoning" : `If ${fmtNum(markPrice)} settles…`}
                    </span>
                    <span className={`stat-value ${pnlClass(totalAtMark)}`} style={{ fontSize: 15 }}>
                      net {totalAtMark >= 0 ? "+" : ""}
                      {fmtMoney(totalAtMark)}
                    </span>
                  </div>
                  <div className="panel-body">
                    <div className="iou-grid">
                      {ledger.map((l) => {
                        const cls = l.pnl > 0.005 ? "owes-you" : l.pnl < -0.005 ? "you-owe" : "square";
                        return (
                          <div key={l.counterparty} className={`iou-card ${cls}`}>
                            <div className="iou-head">
                              <div className="iou-name">{l.counterparty}</div>
                              <div
                                className="iou-verdict"
                                style={{
                                  color:
                                    l.pnl > 0.005
                                      ? "var(--up-deep)"
                                      : l.pnl < -0.005
                                        ? "var(--down-deep)"
                                        : "var(--ink-soft)",
                                }}
                              >
                                {l.pnl > 0.005 ? "owes you" : l.pnl < -0.005 ? "you owe them" : "all square"}
                              </div>
                            </div>
                            <div className={`iou-amount ${pnlClass(l.pnl)}`}>{fmtMoney(Math.abs(l.pnl))}</div>
                            <div className="iou-trades">
                              {l.trades.map(({ trade, pnl }) => (
                                <div key={trade.id} className="iou-trade-row">
                                  <span>
                                    {trade.side === "buy" ? "B" : "S"} {fmtNum(trade.qty)}{" "}
                                    {trade.kind === "future"
                                      ? `OUTRIGHT @ ${fmtNum(trade.price)}`
                                      : `${fmtNum(trade.strike ?? 0)} ${trade.kind.toUpperCase()} @ ${fmtNum(trade.price)}`}
                                  </span>
                                  <span className={`amt ${pnlClass(pnl)}`}>
                                    {pnl >= 0 ? "+" : ""}
                                    {fmtMoney(pnl)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="panel">
                <div className="panel-head">
                  <span className="panel-title">The Tape</span>
                  <span className="subtle">
                    {fills.length} trade{fills.length === 1 ? "" : "s"} on this event
                  </span>
                </div>
                <div className="panel-body" style={{ overflowX: "auto" }}>
                  {fills.length === 0 ? (
                    <div className="empty-note">No prints yet. Quote something.</div>
                  ) : (
                    <table className="blotter">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Market</th>
                          <th className="r">Qty</th>
                          <th className="r">Price</th>
                          <th>Buyer</th>
                          <th>Seller</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fills.map((f) => (
                          <tr key={f.id}>
                            <td style={{ color: "var(--chalk-faint)" }}>
                              {new Date(f.ts).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td>
                              <span className="kind-tag">
                                {f.kind === "future"
                                  ? "OUTRIGHT"
                                  : `${fmtNum(f.strike ?? 0)} ${f.kind.toUpperCase()}`}
                              </span>
                            </td>
                            <td className="r">{fmtNum(f.qty)}</td>
                            <td className="r num" style={{ fontWeight: 600 }}>
                              {fmtNum(f.price)}
                            </td>
                            <td className={f.buyerId === me ? "pos" : ""}>
                              {f.buyerId === me ? "you" : names[f.buyerId] || "?"}
                            </td>
                            <td className={f.sellerId === me ? "neg" : ""}>
                              {f.sellerId === me ? "you" : names[f.sellerId] || "?"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
