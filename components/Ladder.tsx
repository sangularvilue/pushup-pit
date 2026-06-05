"use client";

import { useMemo, useState } from "react";
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
 * Sparse price ladder: every level with resting orders (plus the last trade).
 * Click a level to arm the action bar, then BID (buy) or OFFER (sell) at that
 * price — crossing orders match automatically, so clicking an offer level and
 * bidding it is a lift; bidding below just rests. New levels via the quote row.
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
  const [selected, setSelected] = useState<number | null>(null);
  const [qty, setQty] = useState("1");
  const [newPrice, setNewPrice] = useState("");

  const { levels, depth, maxDepth } = useMemo(() => {
    const prices = new Set<number>(book.orders.map((o) => o.price));
    if (lastPrice != null) prices.add(lastPrice);
    const levels = [...prices].sort((a, b) => b - a);
    const depth = new Map<string, number>();
    let maxDepth = 1;
    for (const o of book.orders) {
      const k = `${o.side}:${o.price}`;
      const v = (depth.get(k) || 0) + o.qty;
      depth.set(k, v);
      if (v > maxDepth) maxDepth = v;
    }
    return { levels, depth, maxDepth };
  }, [book.orders, lastPrice]);

  const qtyNum = Number(qty);
  const validQty = Number.isFinite(qtyNum) && qtyNum > 0;

  function fire(side: OrderSide, price: number) {
    if (!validQty || disabled) return;
    onOrder(side, price, qtyNum);
    setSelected(null);
  }

  const nameOf = (id: string) => (id === me ? "you" : names[id] || "?");

  return (
    <div className="ladder">
      {selected != null && !disabled && (
        <div className="ladder-action">
          <span className="num" style={{ fontSize: 15, fontWeight: 700, color: "var(--brass)" }}>
            {fmtNum(selected)}
          </span>
          <div className="field" style={{ width: 70 }}>
            <label className="flabel">Qty</label>
            <input className="finput" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <button className="btn btn-buy" disabled={busy || !validQty} onClick={() => fire("bid", selected)}>
            Bid
          </button>
          <button className="btn btn-sell" disabled={busy || !validQty} onClick={() => fire("offer", selected)}>
            Offer
          </button>
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>
            never mind
          </button>
        </div>
      )}

      <div className="ladder-head">
        <div style={{ textAlign: "right", paddingRight: 6 }}>Bids</div>
        <div style={{ textAlign: "center" }}>Price</div>
        <div style={{ paddingLeft: 6 }}>Offers</div>
      </div>
      <div className="ladder-scroll">
        {levels.length === 0 && (
          <div className="empty-note" style={{ margin: 8 }}>
            Nobody&apos;s quoting. Be the first — post a level below.
          </div>
        )}
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
              className={`ladder-row${selected === price ? " selected" : ""}${lastPrice === price ? " last-trade" : ""}`}
              onClick={() => !disabled && setSelected(selected === price ? null : price)}
            >
              <div className="ladder-cell bids">
                {bidDepth > 0 && <div className="depth-bar" style={{ width: `${(bidDepth / maxDepth) * 100}%` }} />}
                {bids.map((o) => (
                  <span key={o.id} className={`order-chip bid-chip${o.userId === me ? " mine" : ""}`}>
                    {nameOf(o.userId)}
                    {o.qty !== 1 && <span style={{ opacity: 0.65 }}>×{fmtNum(o.qty)}</span>}
                    {o.userId === me && !disabled && (
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
                    )}
                  </span>
                ))}
              </div>
              <div className="ladder-price">{fmtNum(price)}</div>
              <div className="ladder-cell offers">
                {offerDepth > 0 && (
                  <div className="depth-bar" style={{ width: `${(offerDepth / maxDepth) * 100}%` }} />
                )}
                {offers.map((o) => (
                  <span key={o.id} className={`order-chip offer-chip${o.userId === me ? " mine" : ""}`}>
                    {nameOf(o.userId)}
                    {o.qty !== 1 && <span style={{ opacity: 0.65 }}>×{fmtNum(o.qty)}</span>}
                    {o.userId === me && !disabled && (
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
                    )}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!disabled && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", paddingTop: 12 }}>
          <div className="field" style={{ width: 100 }}>
            <label className="flabel">Price</label>
            <input
              className="finput"
              inputMode="decimal"
              placeholder="level"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
          </div>
          <div className="field" style={{ width: 70 }}>
            <label className="flabel">Qty</label>
            <input className="finput" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <button
            className="btn btn-buy"
            disabled={busy || !validQty || !Number.isFinite(Number(newPrice)) || newPrice.trim() === ""}
            onClick={() => fire("bid", Number(newPrice))}
          >
            Bid
          </button>
          <button
            className="btn btn-sell"
            disabled={busy || !validQty || !Number.isFinite(Number(newPrice)) || newPrice.trim() === ""}
            onClick={() => fire("offer", Number(newPrice))}
          >
            Offer
          </button>
        </div>
      )}
    </div>
  );
}
