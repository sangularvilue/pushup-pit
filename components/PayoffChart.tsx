"use client";

import { useMemo, useRef, useState } from "react";
import {
  breakevens,
  chartDomain,
  fmtMoney,
  fmtNum,
  kinkXs,
  portfolioPnl,
} from "@/lib/payoff";
import type { Trade } from "@/lib/types";

const W = 820;
const PAD = { l: 64, r: 20, t: 18, b: 40 };

const PARTY_COLORS = [
  "#e3b04e",
  "#7fd0e8",
  "#e58fb1",
  "#9ee37d",
  "#caa9f5",
  "#f2a05e",
  "#8be8c8",
  "#e8e07f",
];

function niceTicks(lo: number, hi: number, count: number): number[] {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 10 : norm >= 2.5 ? 5 : norm >= 1.5 ? 2.5 : norm >= 1 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return ticks;
}

export interface PayoffChartProps {
  trades: Trade[];
  tickValue: number;
  unit: string;
  /** Vertical brass marker (final settlement). */
  settlement?: number | null;
  /** Dashed what-if marker. */
  whatIf?: number | null;
  /** Show thin per-counterparty payoff lines. */
  showParties?: boolean;
  /** Pending (unconfirmed) ticket — previewed against the current book. */
  draft?: Trade | null;
  /** Short chart for the mobile layout (820×260 viewBox). */
  compact?: boolean;
}

export default function PayoffChart({
  trades,
  tickValue,
  unit,
  settlement,
  whatIf,
  showParties = false,
  draft = null,
  compact = false,
}: PayoffChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const H = compact ? 260 : 420;

  // "book" is what gets drawn bold: current trades, plus the pending ticket if any.
  const book = useMemo(() => (draft ? [...trades, draft] : trades), [trades, draft]);

  const model = useMemo(() => {
    let [xLo, xHi] = chartDomain(book);
    for (const m of [settlement, whatIf]) {
      if (m != null && Number.isFinite(m)) {
        if (m < xLo) xLo = Math.max(0, Math.floor(m - (xHi - xLo) * 0.1));
        if (m > xHi) xHi = Math.ceil(m + (xHi - xLo) * 0.1);
      }
    }
    if (xHi <= xLo) xHi = xLo + 10;

    // sample xs: dense grid + exact kinks so corners are sharp
    const xs: number[] = [];
    const N = 160;
    for (let i = 0; i <= N; i++) xs.push(xLo + ((xHi - xLo) * i) / N);
    for (const k of kinkXs(book)) if (k >= xLo && k <= xHi) xs.push(k);
    xs.sort((a, b) => a - b);

    const total = xs.map((x) => portfolioPnl(book, x, tickValue));
    // ghost of the confirmed book, shown while a ticket is pending
    const before = draft ? xs.map((x) => portfolioPnl(trades, x, tickValue)) : null;

    const parties = new Map<string, number[]>();
    if (showParties) {
      const names = [...new Set(trades.map((t) => t.counterparty.trim() || "(unknown)"))];
      for (const name of names) {
        const sub = trades.filter((t) => (t.counterparty.trim() || "(unknown)") === name);
        parties.set(name, xs.map((x) => portfolioPnl(sub, x, tickValue)));
      }
    }

    let yLo = Math.min(0, ...total, ...(before ?? []));
    let yHi = Math.max(0, ...total, ...(before ?? []));
    for (const vals of parties.values()) {
      yLo = Math.min(yLo, ...vals);
      yHi = Math.max(yHi, ...vals);
    }
    if (yHi === yLo) {
      yHi += 10;
      yLo -= 10;
    }
    const yPad = (yHi - yLo) * 0.12;
    yLo -= yPad;
    yHi += yPad;

    const sx = (x: number) => PAD.l + ((x - xLo) / (xHi - xLo)) * (W - PAD.l - PAD.r);
    const sy = (y: number) => PAD.t + ((yHi - y) / (yHi - yLo)) * (H - PAD.t - PAD.b);

    const bes = breakevens(book, tickValue, xLo, xHi);

    return { xLo, xHi, yLo, yHi, xs, total, before, parties, sx, sy, bes };
  }, [book, trades, draft, tickValue, settlement, whatIf, showParties, H]);

  const { xLo, xHi, yLo, yHi, xs, total, before, parties, sx, sy, bes } = model;

  const linePath = xs.map((x, i) => `${i ? "L" : "M"}${sx(x).toFixed(2)},${sy(total[i]).toFixed(2)}`).join("");
  const areaPath =
    book.length > 0
      ? `${linePath}L${sx(xHi).toFixed(2)},${sy(0).toFixed(2)}L${sx(xLo).toFixed(2)},${sy(0).toFixed(2)}Z`
      : "";

  const zeroY = sy(0);
  const xTicks = niceTicks(xLo, xHi, compact ? 6 : 8);
  const yTicks = niceTicks(yLo, yHi, compact ? 4 : 6);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const x = xLo + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (xHi - xLo);
    setHoverX(x >= xLo && x <= xHi ? x : null);
  }

  const hoverPnl = hoverX != null ? portfolioPnl(book, hoverX, tickValue) : null;

  const partyEntries = [...parties.entries()];

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", display: "block", cursor: book.length ? "crosshair" : "default" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverX(null)}
      >
        <defs>
          <clipPath id="clip-above">
            <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={Math.max(0, zeroY - PAD.t)} />
          </clipPath>
          <clipPath id="clip-below">
            <rect x={PAD.l} y={zeroY} width={W - PAD.l - PAD.r} height={Math.max(0, H - PAD.b - zeroY)} />
          </clipPath>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* grid */}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} y1={PAD.t} x2={sx(t)} y2={H - PAD.b} stroke="rgba(243,234,215,0.07)" />
            <text
              x={sx(t)}
              y={H - PAD.b + 18}
              textAnchor="middle"
              fontSize="11"
              fontFamily="var(--font-mono)"
              fill="rgba(243,234,215,0.5)"
            >
              {fmtNum(t)}
            </text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.l} y1={sy(t)} x2={W - PAD.r} y2={sy(t)} stroke="rgba(243,234,215,0.07)" />
            <text
              x={PAD.l - 8}
              y={sy(t) + 4}
              textAnchor="end"
              fontSize="11"
              fontFamily="var(--font-mono)"
              fill="rgba(243,234,215,0.5)"
            >
              {t === 0 ? "0" : fmtMoney(t)}
            </text>
          </g>
        ))}

        {/* zero line */}
        <line
          x1={PAD.l}
          y1={zeroY}
          x2={W - PAD.r}
          y2={zeroY}
          stroke="rgba(243,234,215,0.55)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />

        {/* strikes */}
        {kinkXs(book).map((k) => (
          <line
            key={`k${k}`}
            x1={sx(k)}
            y1={H - PAD.b}
            x2={sx(k)}
            y2={H - PAD.b - 10}
            stroke="#e3b04e"
            strokeWidth="2"
          />
        ))}

        {/* P&L shading */}
        {areaPath && (
          <>
            <path d={areaPath} fill="#3ecf81" opacity="0.16" clipPath="url(#clip-above)" />
            <path d={areaPath} fill="#e25141" opacity="0.16" clipPath="url(#clip-below)" />
          </>
        )}

        {/* per-counterparty lines */}
        {partyEntries.map(([name, vals], pi) => (
          <path
            key={name}
            d={xs.map((x, i) => `${i ? "L" : "M"}${sx(x).toFixed(2)},${sy(vals[i]).toFixed(2)}`).join("")}
            fill="none"
            stroke={PARTY_COLORS[pi % PARTY_COLORS.length]}
            strokeWidth="1.4"
            strokeDasharray="2 3"
            opacity="0.85"
          />
        ))}

        {/* ghost of the confirmed book while a ticket is pending */}
        {before && trades.length > 0 && (
          <path
            d={xs.map((x, i) => `${i ? "L" : "M"}${sx(x).toFixed(2)},${sy(before[i]).toFixed(2)}`).join("")}
            fill="none"
            stroke="rgba(243,234,215,0.4)"
            strokeWidth="1.8"
            strokeDasharray="7 5"
            strokeLinejoin="round"
          />
        )}

        {/* total payoff line */}
        {book.length > 0 && (
          <path d={linePath} fill="none" stroke="#f3ead7" strokeWidth="2.8" filter="url(#glow)" strokeLinejoin="round" />
        )}

        {/* breakevens */}
        {bes.map((b, i) => (
          <g key={`be${i}`}>
            <circle cx={sx(b)} cy={zeroY} r="4.5" fill="#e3b04e" stroke="#0d2118" strokeWidth="1.5" />
            <text
              x={sx(b)}
              y={zeroY - 10}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fontFamily="var(--font-mono)"
              fill="#e3b04e"
            >
              {fmtNum(Math.round(b * 100) / 100)}
            </text>
          </g>
        ))}

        {/* what-if marker */}
        {whatIf != null && Number.isFinite(whatIf) && whatIf >= xLo && whatIf <= xHi && (
          <g>
            <line
              x1={sx(whatIf)}
              y1={PAD.t}
              x2={sx(whatIf)}
              y2={H - PAD.b}
              stroke="#7fd0e8"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <circle cx={sx(whatIf)} cy={sy(portfolioPnl(book, whatIf, tickValue))} r="5" fill="#7fd0e8" stroke="#0d2118" strokeWidth="1.5" />
          </g>
        )}

        {/* settlement marker */}
        {settlement != null && Number.isFinite(settlement) && settlement >= xLo && settlement <= xHi && (
          <g>
            <line x1={sx(settlement)} y1={PAD.t} x2={sx(settlement)} y2={H - PAD.b} stroke="#e3b04e" strokeWidth="2.5" />
            <rect x={sx(settlement) - 44} y={PAD.t} width="88" height="20" rx="2" fill="#e3b04e" />
            <text
              x={sx(settlement)}
              y={PAD.t + 14}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fontFamily="var(--font-mono)"
              fill="#1d2b24"
            >
              SETTLED {fmtNum(settlement)}
            </text>
            <circle cx={sx(settlement)} cy={sy(portfolioPnl(book, settlement, tickValue))} r="6" fill="#e3b04e" stroke="#0d2118" strokeWidth="2" />
          </g>
        )}

        {/* hover crosshair */}
        {hoverX != null && book.length > 0 && hoverPnl != null && (
          <g pointerEvents="none">
            <line x1={sx(hoverX)} y1={PAD.t} x2={sx(hoverX)} y2={H - PAD.b} stroke="rgba(243,234,215,0.35)" strokeWidth="1" />
            <circle cx={sx(hoverX)} cy={sy(hoverPnl)} r="5" fill={hoverPnl >= 0 ? "#3ecf81" : "#e25141"} stroke="#0d2118" strokeWidth="1.5" />
            {(() => {
              const boxW = 162;
              const bx = Math.min(Math.max(sx(hoverX) + 12, PAD.l), W - PAD.r - boxW);
              const by = Math.max(sy(hoverPnl) - 52, PAD.t + 2);
              return (
                <g>
                  <rect x={bx} y={by} width={boxW} height="42" rx="3" fill="#f3ead7" stroke="#1d2b24" />
                  <text x={bx + 10} y={by + 17} fontSize="11.5" fontFamily="var(--font-mono)" fill="#4a5a50">
                    {fmtNum(Math.round(hoverX * 10) / 10)} {unit}s
                  </text>
                  <text
                    x={bx + 10}
                    y={by + 33}
                    fontSize="13"
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                    fill={hoverPnl >= 0 ? "#1e8a52" : "#b03425"}
                  >
                    {hoverPnl >= 0 ? "+" : ""}
                    {fmtMoney(hoverPnl)}
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {/* axis labels */}
        <text
          x={(PAD.l + W - PAD.r) / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize="10.5"
          letterSpacing="2"
          fontFamily="var(--font-mono)"
          fill="rgba(243,234,215,0.45)"
        >
          SETTLEMENT ({unit.toUpperCase()}S)
        </text>

        {book.length === 0 && (
          <text
            x={W / 2}
            y={H / 2}
            textAnchor="middle"
            fontSize="14"
            fontFamily="var(--font-mono)"
            fill="rgba(243,234,215,0.4)"
          >
            No trades yet — write your first ticket.
          </text>
        )}
      </svg>

      {draft && (
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "6px 4px 0",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
          }}
        >
          <span style={{ color: "rgba(243,234,215,0.5)" }}>─ ─ current book</span>
          <span style={{ color: "#f3ead7", fontWeight: 600 }}>━ with pending ticket</span>
        </div>
      )}

      {showParties && partyEntries.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 16px",
            padding: "6px 4px 0",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
          }}
        >
          {partyEntries.map(([name], pi) => (
            <span key={name} style={{ color: PARTY_COLORS[pi % PARTY_COLORS.length] }}>
              ─ ─ {name}
            </span>
          ))}
          <span style={{ color: "var(--chalk-dim)" }}>━ total book</span>
        </div>
      )}
    </div>
  );
}
