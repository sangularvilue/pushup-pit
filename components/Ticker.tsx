const QUOTES: { sym: string; px: string; up: boolean }[] = [
  { sym: "JSMITH 5MIN", px: "92", up: true },
  { sym: "OFFICE PLANK", px: "184s", up: false },
  { sym: "NEWGUY MAX", px: "31", up: true },
  { sym: "BURPEE DEC", px: "57", up: false },
  { sym: "PULLUP STRADDLE 12", px: "4.5", up: true },
  { sym: "INTERN SITUPS", px: "66", up: true },
  { sym: "BOSS 1MIN", px: "22", up: false },
  { sym: "WKND 10K PACE", px: "47:30", up: true },
  { sym: "GYM ATTENDANCE JAN", px: "3", up: false },
  { sym: "JSMITH 93 CALL", px: "7", up: true },
];

export default function Ticker() {
  const strip = QUOTES.map((q, i) => (
    <span key={i} className={q.up ? "tick-up" : "tick-down"}>
      {q.sym} {q.up ? "▲" : "▼"} {q.px}
    </span>
  ));
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-inner">
        {strip}
        {strip.map((el, i) => (
          <span key={`b${i}`} className={QUOTES[i].up ? "tick-up" : "tick-down"}>
            {QUOTES[i].sym} {QUOTES[i].up ? "▲" : "▼"} {QUOTES[i].px}
          </span>
        ))}
      </div>
    </div>
  );
}
