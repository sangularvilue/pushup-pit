"use client";

import { useEffect, useState } from "react";
import { fmtNum } from "@/lib/payoff";
import type { TapeEntry } from "@/lib/types";

/** Marquee of real transactions on the exchange. Polls the tape. */
export default function Ticker() {
  const [tape, setTape] = useState<TapeEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/tape")
        .then((r) => r.json())
        .then((d) => alive && setTape(d.tape || []))
        .catch(() => {});
    load();
    const t = setInterval(load, 12000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const strip = (keyPrefix: string) =>
    tape && tape.length > 0 ? (
      tape.map((t, i) => (
        <span key={`${keyPrefix}${t.id}`} className={i % 2 ? "tick-down" : "tick-up"}>
          {t.buyerName.toUpperCase()} ✕ {t.sellerName.toUpperCase()} · {fmtNum(t.qty)}{" "}
          {t.marketLabel} @ {fmtNum(t.price)}{" "}
          <span style={{ opacity: 0.55 }}>({t.eventName.toUpperCase()})</span>
        </span>
      ))
    ) : (
      <span key={`${keyPrefix}quiet`} className="tick-up">
        THE TAPE IS QUIET · EVERY REAL TRADE ON THE EXCHANGE PRINTS HERE · QUOTE SOMETHING
      </span>
    );

  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-inner">
        {strip("a")}
        {strip("b")}
      </div>
    </div>
  );
}
