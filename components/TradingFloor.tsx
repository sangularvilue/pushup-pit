"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtNum } from "@/lib/payoff";
import type { EventSummary } from "@/lib/types";

export default function TradingFloor() {
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [err, setErr] = useState("");

  // listing form
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pushup");
  const [tick, setTick] = useState("1");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState("");

  useEffect(() => {
    fetch("/api/events")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Failed to load.");
        setEvents(data.events);
      })
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setFormErr("");
    if (!name.trim()) return setFormErr("Give the contract a name.");
    setCreating(true);
    try {
      const r = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, unit, tickValue: Number(tick), description: desc }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to list contract.");
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
        <span className="subtle">every contract you&apos;ve listed, open or settled</span>
      </div>

      <div className="desk-grid">
        <div className="desk-col">
          <form className="ticket" onSubmit={createEvent}>
            <div className="ticket-head">
              <span className="ticket-title">List a Contract</span>
            </div>
            <div className="ticket-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label className="flabel">Contract name</label>
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
                  <input
                    className="finput"
                    inputMode="decimal"
                    value={tick}
                    onChange={(e) => setTick(e.target.value)}
                  />
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
            </div>
          </form>
        </div>

        <div className="desk-col">
          {err && <p className="error-text">{err}</p>}
          {events === null ? (
            <p className="mono-sub">Loading the board…</p>
          ) : events.length === 0 ? (
            <div className="empty-note" style={{ padding: 48 }}>
              No contracts on the board yet.
              <br />
              List one on the left — someone in your office is about to overestimate themselves.
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
                      ${fmtNum(ev.tickValue)}/{ev.unit} · {ev.tradeCount} trade
                      {ev.tradeCount === 1 ? "" : "s"} · {ev.counterparties} cpty
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
