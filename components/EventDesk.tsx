"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import PayoffChart from "./PayoffChart";
import {
  breakevens,
  chartDomain,
  extremes,
  fmtMoney,
  fmtNum,
  positions,
  settleByCounterparty,
  tradePnl,
} from "@/lib/payoff";
import type { Kind, PitEvent, Side, Trade } from "@/lib/types";

const KIND_LABEL: Record<Kind, string> = {
  future: "Future",
  call: "Call",
  put: "Put",
  straddle: "Straddle",
};

function descTrade(t: Trade, unit: string): string {
  if (t.kind === "future") return `FUT @ ${fmtNum(t.price)}`;
  return `${fmtNum(t.strike ?? 0)} ${t.kind.toUpperCase()} @ ${fmtNum(t.price)}`;
}

function pnlClass(v: number): string {
  return v > 0.005 ? "pos" : v < -0.005 ? "neg" : "flat";
}

export default function EventDesk({ id }: { id: string }) {
  const router = useRouter();
  const [event, setEvent] = useState<PitEvent | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // ticket form
  const [side, setSide] = useState<Side>("buy");
  const [kind, setKind] = useState<Kind>("future");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [strike, setStrike] = useState("");
  const [party, setParty] = useState("");
  const [ticketErr, setTicketErr] = useState("");

  // analysis
  const [whatIfStr, setWhatIfStr] = useState("");
  const [showParties, setShowParties] = useState(false);
  const [settleStr, setSettleStr] = useState("");
  const [editingSpecs, setEditingSpecs] = useState(false);
  const [specName, setSpecName] = useState("");
  const [specUnit, setSpecUnit] = useState("");
  const [specTick, setSpecTick] = useState("");
  const [specDesc, setSpecDesc] = useState("");

  const partyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/events/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Failed to load.");
        if (alive) setEvent(data.event);
      })
      .catch((e) => alive && setLoadErr(String(e.message || e)));
    return () => {
      alive = false;
    };
  }, [id]);

  const persist = useCallback(
    async (next: PitEvent) => {
      setEvent(next);
      setSaving(true);
      setSaveErr("");
      try {
        const r = await fetch(`/api/events/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: next }),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => null);
          throw new Error(data?.error || "Save failed.");
        }
      } catch (e) {
        setSaveErr(String((e as Error).message || e));
      } finally {
        setSaving(false);
      }
    },
    [id]
  );

  const trades = event?.trades ?? [];
  const tickValue = event?.tickValue ?? 1;
  const unit = event?.unit ?? "pushup";
  const settled = event?.settlement != null;

  const whatIf = whatIfStr.trim() === "" ? null : Number(whatIfStr);
  const validWhatIf = whatIf != null && Number.isFinite(whatIf) ? whatIf : null;
  const markPrice = settled ? event!.settlement! : validWhatIf;

  const { maxProfit, maxLoss } = useMemo(() => extremes(trades, tickValue), [trades, tickValue]);
  const posLines = useMemo(() => positions(trades), [trades]);
  const ledger = useMemo(
    () => (markPrice != null ? settleByCounterparty(trades, markPrice, tickValue) : []),
    [trades, markPrice, tickValue]
  );
  const totalAtMark = ledger.reduce((a, l) => a + l.pnl, 0);
  const [domLo, domHi] = useMemo(() => chartDomain(trades), [trades]);

  if (loadErr) {
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

  function addTrade(e: React.FormEvent) {
    e.preventDefault();
    setTicketErr("");
    const q = Number(qty);
    const p = Number(price);
    const k = Number(strike);
    if (!Number.isFinite(q) || q <= 0) return setTicketErr("Quantity must be positive.");
    if (!Number.isFinite(p)) return setTicketErr(kind === "future" ? "Enter a price." : "Enter a premium.");
    if (kind !== "future" && !Number.isFinite(k)) return setTicketErr("Enter a strike.");
    if (!party.trim()) return setTicketErr("Who did you trade with?");
    const t: Trade = {
      id: uuid(),
      side,
      kind,
      qty: q,
      price: p,
      strike: kind === "future" ? undefined : k,
      counterparty: party.trim(),
      ts: Date.now(),
    };
    persist({ ...event!, trades: [...trades, t] });
    setPrice("");
    setTicketErr("");
  }

  function removeTrade(tid: string) {
    persist({ ...event!, trades: trades.filter((t) => t.id !== tid) });
  }

  function ringTheBell(e: React.FormEvent) {
    e.preventDefault();
    const s = Number(settleStr);
    if (!Number.isFinite(s)) return;
    persist({ ...event!, settlement: s });
  }

  function reopen() {
    setSettleStr(event!.settlement != null ? String(event!.settlement) : "");
    persist({ ...event!, settlement: null });
  }

  function startEditSpecs() {
    setSpecName(event!.name);
    setSpecUnit(event!.unit);
    setSpecTick(String(event!.tickValue));
    setSpecDesc(event!.description || "");
    setEditingSpecs(true);
  }

  function saveSpecs(e: React.FormEvent) {
    e.preventDefault();
    const tv = Number(specTick);
    persist({
      ...event!,
      name: specName.trim() || event!.name,
      unit: specUnit.trim() || event!.unit,
      tickValue: Number.isFinite(tv) && tv > 0 ? tv : event!.tickValue,
      description: specDesc,
    });
    setEditingSpecs(false);
  }

  async function deleteEvent() {
    if (!confirm(`Delist "${event!.name}" and all its trades? This can't be undone.`)) return;
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    router.push("/pit");
  }

  const ticketSummary =
    price.trim() && (kind === "future" || strike.trim()) && Number(qty) > 0
      ? `${side === "buy" ? "BUY" : "SELL"} ${qty} × ${
          kind === "future" ? `FUT @ ${price}` : `${strike} ${kind.toUpperCase()} @ ${price}`
        }${party.trim() ? ` ${side === "buy" ? "from" : "to"} ${party.trim()}` : ""}`
      : null;

  return (
    <div className="shell">
      <div className="page-title-row">
        <div>
          <div className="mono-sub">
            <Link href="/pit">← trading floor</Link>
          </div>
          <h1 className="page-title">{event.name}</h1>
          <div className="mono-sub" style={{ marginTop: 4 }}>
            ${fmtNum(tickValue)} per {unit} per contract
            {event.description ? ` · ${event.description}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {saving && <span className="mono-sub">saving…</span>}
          {saveErr && <span className="error-text">{saveErr}</span>}
          <span className={`badge ${settled ? "badge-settled" : "badge-open"}`}>
            {settled ? `Settled · ${fmtNum(event.settlement!)}` : "Market open"}
          </span>
        </div>
      </div>

      {settled && (
        <div className="settled-banner">
          <span className="big">🔔 Final print: {fmtNum(event.settlement!)} {unit}s</span>
          <span className="num">
            Your book: <span className={pnlClass(totalAtMark)}>{totalAtMark >= 0 ? "+" : ""}{fmtMoney(totalAtMark)}</span>
          </span>
          <button className="btn btn-ink" onClick={reopen}>
            Reopen market
          </button>
        </div>
      )}

      <div className="desk-grid">
        {/* ============ LEFT: ticket + specs + positions ============ */}
        <div className="desk-col">
          <form className="ticket" onSubmit={addTrade}>
            <div className="ticket-head">
              <span className="ticket-title">Trade Ticket</span>
              <span className="num" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                #{String(trades.length + 1).padStart(3, "0")}
              </span>
            </div>
            <div className="ticket-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="side-toggle">
                <button
                  type="button"
                  className={`btn btn-buy ${side === "buy" ? "active" : ""}`}
                  onClick={() => setSide("buy")}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className={`btn btn-sell ${side === "sell" ? "active" : ""}`}
                  onClick={() => setSide("sell")}
                >
                  Sell
                </button>
              </div>
              <div className="form-row">
                <div className="field">
                  <label className="flabel">Instrument</label>
                  <select
                    className="finput"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as Kind)}
                  >
                    <option value="future">Future</option>
                    <option value="call">Call</option>
                    <option value="put">Put</option>
                    <option value="straddle">Straddle</option>
                  </select>
                </div>
                <div className="field">
                  <label className="flabel">Qty</label>
                  <input
                    className="finput"
                    inputMode="decimal"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-row">
                {kind !== "future" && (
                  <div className="field">
                    <label className="flabel">Strike</label>
                    <input
                      className="finput"
                      inputMode="decimal"
                      placeholder="93"
                      value={strike}
                      onChange={(e) => setStrike(e.target.value)}
                    />
                  </div>
                )}
                <div className="field">
                  <label className="flabel">{kind === "future" ? "Price" : "Premium"}</label>
                  <input
                    className="finput"
                    inputMode="decimal"
                    placeholder={kind === "future" ? "90" : "7"}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label className="flabel">Counterparty</label>
                <input
                  ref={partyRef}
                  className="finput"
                  placeholder="Adam"
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  list="party-list"
                />
                <datalist id="party-list">
                  {[...new Set(trades.map((t) => t.counterparty))].map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              {ticketSummary && (
                <div
                  className="num"
                  style={{
                    fontSize: 12,
                    color: side === "buy" ? "var(--up-deep)" : "var(--down-deep)",
                    fontWeight: 600,
                  }}
                >
                  {ticketSummary}
                </div>
              )}
              {ticketErr && <div className="error-text">{ticketErr}</div>}
              <button type="submit" className={`btn btn-big ${side === "buy" ? "btn-buy" : "btn-sell"}`}>
                {side === "buy" ? "Lift the offer" : "Hit the bid"}
              </button>
            </div>
          </form>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Net Position</span>
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
                            ? "FUTURES"
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
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Contract Specs</span>
              {!editingSpecs && (
                <button className="del-btn" onClick={startEditSpecs}>
                  edit
                </button>
              )}
            </div>
            <div className="panel-body">
              {editingSpecs ? (
                <form onSubmit={saveSpecs} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="field">
                    <label className="flabel">Contract name</label>
                    <input className="finput" value={specName} onChange={(e) => setSpecName(e.target.value)} />
                  </div>
                  <div className="form-row">
                    <div className="field">
                      <label className="flabel">Unit</label>
                      <input className="finput" value={specUnit} onChange={(e) => setSpecUnit(e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="flabel">$ per unit</label>
                      <input className="finput" inputMode="decimal" value={specTick} onChange={(e) => setSpecTick(e.target.value)} />
                    </div>
                  </div>
                  <div className="field">
                    <label className="flabel">Notes</label>
                    <input className="finput" value={specDesc} onChange={(e) => setSpecDesc(e.target.value)} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" className="btn btn-gold">
                      Save
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setEditingSpecs(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mono-sub" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span>Tick value · ${fmtNum(tickValue)} per {unit}</span>
                  <span>Trades on the tape · {trades.length}</span>
                  <span>
                    Counterparties ·{" "}
                    {new Set(trades.map((t) => t.counterparty.trim().toLowerCase())).size}
                  </span>
                  <button
                    className="del-btn"
                    style={{ alignSelf: "flex-start", marginTop: 8 }}
                    onClick={deleteEvent}
                  >
                    ✕ delist contract
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============ RIGHT: chart + stats + settlement + blotter ============ */}
        <div className="desk-col">
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Payoff at Settlement</span>
              <label
                className="mono-sub"
                style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={showParties}
                  onChange={(e) => setShowParties(e.target.checked)}
                />
                per-counterparty
              </label>
            </div>
            <div className="panel-body" style={{ paddingTop: 8 }}>
              <PayoffChart
                trades={trades}
                tickValue={tickValue}
                unit={unit}
                settlement={settled ? event.settlement : null}
                whatIf={settled ? null : validWhatIf}
                showParties={showParties}
              />
            </div>
          </div>

          <div className="stat-row">
            <div className="stat">
              <div className="stat-label">Max profit</div>
              <div className={`stat-value ${maxProfit === Infinity ? "pos" : pnlClass(maxProfit)}`}>
                {trades.length ? fmtMoney(maxProfit) : "—"}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Max loss</div>
              <div className={`stat-value ${maxLoss === -Infinity ? "neg" : pnlClass(maxLoss)}`}>
                {trades.length ? fmtMoney(maxLoss) : "—"}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Breakevens</div>
              <div className="stat-value" style={{ color: "var(--brass)" }}>
                {trades.length
                  ? (() => {
                      const bes = [
                        ...new Set(
                          breakevens(trades, tickValue, Math.max(0, domLo), domHi).map(
                            (b) => Math.round(b * 100) / 100
                          )
                        ),
                      ];
                      return bes.length ? bes.map(fmtNum).join(" / ") : "none";
                    })()
                  : "—"}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">{settled ? "P&L at settle" : "P&L at what-if"}</div>
              <div className={`stat-value ${markPrice != null ? pnlClass(totalAtMark) : "flat"}`}>
                {markPrice != null ? `${totalAtMark >= 0 ? "+" : ""}${fmtMoney(totalAtMark)}` : "—"}
              </div>
            </div>
          </div>

          {!settled && (
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Settlement Desk</span>
                <span className="subtle">drag the what-if, then ring the bell</span>
              </div>
              <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <div className="field" style={{ width: 130 }}>
                    <label className="flabel">What-if ({unit}s)</label>
                    <input
                      className="finput"
                      inputMode="decimal"
                      placeholder="e.g. 87"
                      value={whatIfStr}
                      onChange={(e) => setWhatIfStr(e.target.value)}
                    />
                  </div>
                  <input
                    type="range"
                    min={Math.max(0, domLo)}
                    max={domHi}
                    step={(domHi - domLo) / 200 || 1}
                    value={validWhatIf ?? Math.max(0, domLo)}
                    onChange={(e) => setWhatIfStr(e.target.value)}
                    style={{ flex: 1, minWidth: 160, accentColor: "#7fd0e8" }}
                  />
                  <form onSubmit={ringTheBell} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
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
                    <button type="submit" className="btn btn-gold" disabled={!Number.isFinite(Number(settleStr)) || settleStr.trim() === ""}>
                      🔔 Ring the bell
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {markPrice != null && ledger.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">
                  {settled ? "The Reckoning" : `If it settles at ${fmtNum(markPrice)}…`}
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
                          <div className="iou-verdict" style={{ color: l.pnl > 0.005 ? "var(--up-deep)" : l.pnl < -0.005 ? "var(--down-deep)" : "var(--ink-soft)" }}>
                            {l.pnl > 0.005 ? "owes you" : l.pnl < -0.005 ? "you owe them" : "all square"}
                          </div>
                        </div>
                        <div className={`iou-amount ${pnlClass(l.pnl)}`}>{fmtMoney(Math.abs(l.pnl))}</div>
                        <div className="iou-trades">
                          {l.trades.map(({ trade, pnl }) => (
                            <div key={trade.id} className="iou-trade-row">
                              <span>
                                {trade.side === "buy" ? "B" : "S"} {fmtNum(trade.qty)} {descTrade(trade, unit)}
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
              <span className="subtle">{trades.length} trade{trades.length === 1 ? "" : "s"}</span>
            </div>
            <div className="panel-body" style={{ overflowX: "auto" }}>
              {trades.length === 0 ? (
                <div className="empty-note">Nothing on the tape. Write a ticket on the left.</div>
              ) : (
                <table className="blotter">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Side</th>
                      <th className="r">Qty</th>
                      <th>Instrument</th>
                      <th>Counterparty</th>
                      <th className="r">{markPrice != null ? `P&L @ ${fmtNum(markPrice)}` : "P&L"}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[...trades]
                      .sort((a, b) => b.ts - a.ts)
                      .map((t) => {
                        const pnl = markPrice != null ? tradePnl(t, markPrice, tickValue) : null;
                        return (
                          <tr key={t.id}>
                            <td style={{ color: "var(--chalk-faint)" }}>
                              {new Date(t.ts).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td>
                              <span className={`pill ${t.side === "buy" ? "pill-buy" : "pill-sell"}`}>
                                {t.side}
                              </span>
                            </td>
                            <td className="r">{fmtNum(t.qty)}</td>
                            <td>
                              <span className="kind-tag">{descTrade(t, unit)}</span>
                            </td>
                            <td>{t.counterparty}</td>
                            <td className={`r ${pnl != null ? pnlClass(pnl) : "flat"}`} style={{ fontWeight: 600 }}>
                              {pnl != null ? `${pnl >= 0 ? "+" : ""}${fmtMoney(pnl)}` : "—"}
                            </td>
                            <td>
                              {!settled && (
                                <button className="del-btn" title="Bust this trade" onClick={() => removeTrade(t.id)}>
                                  ✕
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
