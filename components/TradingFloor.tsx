"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtNum } from "@/lib/payoff";
import type { EventSummary } from "@/lib/types";

export default function TradingFloor() {
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [err, setErr] = useState("");

  // listing form (admin only)
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pushup");
  const [tick, setTick] = useState("1");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/events")
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data?.error || "Failed to load.");
          if (!alive) return;
          setEvents(data.events);
          setIsAdmin(!!data.isAdmin);
        })
        .catch((e) => alive && setErr(String(e.message || e)));
    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setFormErr("");
    if (!name.trim()) return setFormErr("Give the event a name.");
    setCreating(true);
    try {
      const r = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, unit, tickValue: Number(tick), description: desc }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to list event.");
      router.push(`/pit/${data.event.id}`);
    } catch (e2) {
      setFormErr(String((e2 as Error).message || e2));
      setCreating(false);
    }
  }

  return (
    <div className="shell">
      <div className="page-title-row">
        <h1 className="page-title">The Trading Floor</h1>
        <span className="subtle">
          {isAdmin
            ? "you run this exchange — list events, set settlements"
            : "events are listed by the exchange operator; anyone can register markets and trade"}
        </span>
      </div>

      <div className="desk-grid">
        <div className="desk-col">
          {isAdmin ? (
            <form className="ticket" onSubmit={createEvent}>
              <div className="ticket-head">
                <span className="ticket-title">List an Event</span>
                <span className="num" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                  OPERATOR
                </span>
              </div>
              <div className="ticket-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="field">
                  <label className="flabel">Event name</label>
                  <input
                    className="finput"
                    placeholder="John Smith — pushups in 5 min"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <div className="field">
                    <label className="flabel">Unit</label>
                    <input className="finput" value={unit} onChange={(e) => setUnit(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="flabel">$ per unit</label>
                    <input className="finput" inputMode="decimal" value={tick} onChange={(e) => setTick(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label className="flabel">Notes (optional)</label>
                  <input
                    className="finput"
                    placeholder="Counted by Dave. No knees."
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </div>
                {formErr && <div className="error-text">{formErr}</div>}
                <button type="submit" className="btn btn-ink btn-big" disabled={creating}>
                  {creating ? "Listing…" : "Open the pit"}
                </button>
                <div className="auth-foot" style={{ textAlign: "left" }}>
                  The outright market is listed automatically. Members register the strikes.
                </div>
              </div>
            </form>
          ) : (
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">House Rules</span>
              </div>
              <div className="panel-body mono-sub" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span>1. The operator lists events and settles them.</span>
                <span>2. Anyone can list a call, put, or straddle — but listing means making: 5 up on each side, max 5 wide. Opening quotes stand 5 minutes or until fully executed — partials keep standing, and nothing auto-reloads.</span>
                <span>3. Click the ladder to join a level, 1 lot per click. Crossing trades. First in keeps priority.</span>
                <span>4. Every trade prints on the tape and lands in your inbox.</span>
                <span>5. Settle up like adults.</span>
              </div>
            </div>
          )}
        </div>

        <div className="desk-col">
          {err && <p className="error-text">{err}</p>}
          {events === null ? (
            <p className="mono-sub">Loading the board…</p>
          ) : events.length === 0 ? (
            <div className="empty-note" style={{ padding: 48 }}>
              No events on the board yet.
              {isAdmin ? " List one on the left." : " The operator will list one soon."}
            </div>
          ) : (
            <div className="floor-grid">
              {events.map((ev) => (
                <Link key={ev.id} href={`/pit/${ev.id}`} className="contract-card">
                  <div className="contract-card-top">
                    <div className="contract-name">{ev.name}</div>
                  </div>
                  <div className="contract-meta">
                    <span>
                      ${fmtNum(ev.tickValue)}/{ev.unit} · {ev.marketCount} mkt
                      {ev.marketCount === 1 ? "" : "s"} · {ev.fillCount} trade
                      {ev.fillCount === 1 ? "" : "s"}
                    </span>
                    <span className={`badge ${ev.settlement != null ? "badge-settled" : "badge-open"}`}>
                      {ev.settlement != null ? `Settled ${fmtNum(ev.settlement)}` : "Open"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
