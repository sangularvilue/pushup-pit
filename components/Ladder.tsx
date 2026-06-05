"use client";

import { useEffect, useMemo, useRef } from "react";
import { fmtNum } from "@/lib/payoff";
import type { BookDoc, OrderSide } from "@/lib/types";

export interface LadderProps {
  book: BookDoc;
  names: Record<string, string>;
  me: string;
  disabled: boolean;
  lastPrice: number | null;
  busy: boolean;
  onOrder: (side: OrderSide, price: number, qty: number) => void;
  onCancel: (orderId: string) => void;
}

/**
 * Full price ladder: every integer level in range, scrollable even where
 * nothing rests. Click the bid side to join the bid one lot at that level,
 * click the offer side to offer one — crossing the book trades instead
 * (price-time priority; first at a level keeps it).
 */
export default function Ladder({
  book,
  names,
  me,
  disabled,
  lastPrice,
  busy,
  onOrder,
  onCancel,
}: LadderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const centeredFor = useRef<string>("");

  const { levels, anchor, depth, maxDepth } = useMemo(() => {
    const prices = book.orders.map((o) => o.price);
    if (lastPrice != null) prices.push(lastPrice);
    if (book.market.strike != null && prices.length === 0) prices.push(book.market.strike);

    let lo: number;
    let hi: number;
    if (prices.length > 0) {
      lo = Math.max(0, Math.floor(Math.min(...prices)) - 15);
      hi = Math.ceil(Math.max(...prices)) + 15;
    } else {
      lo = 0;
      hi = 100;
    }

    // integer rungs, plus any off-grid prices actually resting/printed
    const set = new Set<number>();
    for (let p = lo; p <= hi; p++) set.add(p);
    for (const p of prices) set.add(p);
    const levels = [...set].sort((a, b) => b - a);

    const bids = book.orders.filter((o) => o.side === "bid").map((o) => o.price);
    const offers = book.orders.filter((o) => o.side === "offer").map((o) => o.price);
    const bb = bids.length ? Math.max(...bids) : null;
    const bo = offers.length ? Math.min(...offers) : null;
    const anchor =
      bb != null && bo != null
        ? (bb + bo) / 2
        : (bb ?? bo ?? lastPrice ?? (lo + hi) / 2);

    const depth = new Map<string, number>();
    let maxDepth = 1;
    for (const o of book.orders) {
      const k = `${o.side}:${o.price}`;
      const v = (depth.get(k) || 0) + o.qty;
      depth.set(k, v);
      if (v > maxDepth) maxDepth = v;
    }
    return { levels, anchor, depth, maxDepth };
  }, [book.orders, book.market.strike, lastPrice]);

  // center the view on the action when switching markets
  useEffect(() => {
    if (centeredFor.current === book.market.id) return;
    const el = scrollRef.current;
    if (!el) return;
    const idx = levels.findIndex((p) => p <= anchor);
    if (idx < 0) return;
    const row = el.children[idx] as HTMLElement | undefined;
    if (row) {
      el.scrollTop = Math.max(0, row.offsetTop - el.clientHeight / 2 + row.clientHeight / 2);
      centeredFor.current = book.market.id;
    }
  }, [book.market.id, levels, anchor]);

  const nameOf = (id: string) => (id === me ? "you" : names[id] || "?");
  const now = Date.now(); // re-evaluated every poll re-render; lock expiry shows within seconds

  function click(side: OrderSide, price: number) {
    if (disabled || busy) return;
    onOrder(side, price, 1);
  }

  return (
    <div className="ladder">
      <div className="ladder-head">
        <div style={{ textAlign: "right", paddingRight: 6 }}>Bids — click to join / lift</div>
        <div style={{ textAlign: "center" }}>Price</div>
        <div style={{ paddingLeft: 6 }}>Offers — click to join / hit</div>
      </div>
      <div className="ladder-scroll" ref={scrollRef}>
        {levels.map((price) => {
          const bids = book.orders
            .filter((o) => o.side === "bid" && o.price === price)
            .sort((a, b) => a.ts - b.ts);
          const offers = book.orders
            .filter((o) => o.side === "offer" && o.price === price)
            .sort((a, b) => a.ts - b.ts);
          const bidDepth = depth.get(`bid:${price}`) || 0;
          const offerDepth = depth.get(`offer:${price}`) || 0;
          return (
            <div
              key={price}
              className={`ladder-row${lastPrice === price ? " last-trade" : ""}${disabled ? " dead" : ""}`}
            >
              <div className="ladder-cell bids clickable" onClick={() => click("bid", price)} title={disabled ? undefined : `Bid 1 @ ${fmtNum(price)}`}>
                {bidDepth > 0 && <div className="depth-bar" style={{ width: `${(bidDepth / maxDepth) * 100}%` }} />}
                {bids.map((o) => (
                  <span key={o.id} className={`order-chip bid-chip${o.userId === me ? " mine" : ""}`}>
                    {nameOf(o.userId)}
                    {o.qty !== 1 && <span style={{ opacity: 0.65 }}>×{fmtNum(o.qty)}</span>}
                    {o.userId === me &&
                      !disabled &&
                      (o.lockUntil && o.lockUntil > now ? (
                        <span
                          className="x"
                          style={{ cursor: "not-allowed" }}
                          title={`Opening quote — stands until ${new Date(o.lockUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          ⏱
                        </span>
                      ) : (
                        <button
                          className="x"
                          title="Pull this order"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancel(o.id);
                          }}
                        >
                          ✕
                        </button>
                      ))}
                  </span>
                ))}
                {!disabled && <span className="ghost-lot">+1</span>}
              </div>
              <div className="ladder-price">{fmtNum(price)}</div>
              <div className="ladder-cell offers clickable" onClick={() => click("offer", price)} title={disabled ? undefined : `Offer 1 @ ${fmtNum(price)}`}>
                {offerDepth > 0 && (
                  <div className="depth-bar" style={{ width: `${(offerDepth / maxDepth) * 100}%` }} />
                )}
                {!disabled && <span className="ghost-lot">+1</span>}
                {offers.map((o) => (
                  <span key={o.id} className={`order-chip offer-chip${o.userId === me ? " mine" : ""}`}>
                    {nameOf(o.userId)}
                    {o.qty !== 1 && <span style={{ opacity: 0.65 }}>×{fmtNum(o.qty)}</span>}
                    {o.userId === me &&
                      !disabled &&
                      (o.lockUntil && o.lockUntil > now ? (
                        <span
                          className="x"
                          style={{ cursor: "not-allowed" }}
                          title={`Opening quote — stands until ${new Date(o.lockUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          ⏱
                        </span>
                      ) : (
                        <button
                          className="x"
                          title="Pull this order"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancel(o.id);
                          }}
                        >
                          ✕
                        </button>
                      ))}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
