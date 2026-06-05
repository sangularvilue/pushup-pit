import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import Ticker from "@/components/Ticker";

/** Decorative long-straddle payoff for the hero. */
function HeroChart() {
  return (
    <svg viewBox="0 0 420 300" className="hero-chart" aria-hidden="true">
      <rect x="0" y="0" width="420" height="300" rx="8" fill="#16352a" stroke="rgba(243,234,215,0.18)" />
      {[60, 120, 180, 240].map((y) => (
        <line key={y} x1="24" y1={y} x2="396" y2={y} stroke="rgba(243,234,215,0.07)" />
      ))}
      {[100, 175, 250, 325].map((x) => (
        <line key={x} x1={x} y1="20" x2={x} y2="276" stroke="rgba(243,234,215,0.07)" />
      ))}
      <line x1="24" y1="150" x2="396" y2="150" stroke="rgba(243,234,215,0.5)" strokeDasharray="6 4" strokeWidth="1.5" />
      {/* short straddle vs long call composite, just for looks */}
      <path d="M24,250 L160,90 L260,90 L396,250" fill="none" stroke="rgba(127,208,232,0.5)" strokeWidth="1.5" strokeDasharray="3 4" />
      <path
        d="M24,60 L210,238 L396,60"
        fill="none"
        stroke="#f3ead7"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <circle cx="131" cy="150" r="5" fill="#e3b04e" stroke="#0d2118" strokeWidth="1.5" />
      <circle cx="289" cy="150" r="5" fill="#e3b04e" stroke="#0d2118" strokeWidth="1.5" />
      <text x="210" y="270" textAnchor="middle" fontSize="10" letterSpacing="3" fill="rgba(243,234,215,0.45)" fontFamily="monospace">
        PUSHUPS AT THE BELL
      </text>
      <text x="36" y="42" fontSize="11" fill="#3ecf81" fontFamily="monospace" fontWeight="700">
        + LONG 70 STRADDLE
      </text>
    </svg>
  );
}

export default async function LandingPage() {
  const user = await currentUser();
  if (user) redirect("/pit");
  return (
    <>
      <Ticker />
      <SiteHeader />
      <main>
        <section className="hero">
          <div>
            <div className="hero-kicker">EST. TODAY · CLICK-TRADED · NO CLEARINGHOUSE</div>
            <h1>
              PUSHUP<span className="accent">PIT</span>
            </h1>
            <p className="hero-sub">
              TMG&apos;s premier push-up derivatives click-trading exchange. The operator lists an event,
              you register the strikes — calls, puts, straddles — then quote the ladder, hit bids,
              lift offers. Every trade prints on the tape, lands in both inboxes, and moves your
              exposure. Settle up when the reps are counted.
            </p>
            <div className="hero-cta">
              <Link href="/register" className="btn btn-gold btn-big">
                Sign Up
              </Link>
              <Link href="/login" className="btn btn-big">
                Sign in
              </Link>
            </div>
          </div>
          <HeroChart />
        </section>
        <section className="rules">
          <div className="rule-card">
            <div className="rule-num">RULE 01</div>
            <h3>The operator lists</h3>
            <p>
              &ldquo;Pushups John Smith does in 5 minutes.&rdquo; The exchange operator lists the
              event and the outright market. $1 per pushup keeps friendships intact.
            </p>
          </div>
          <div className="rule-card">
            <div className="rule-num">RULE 02</div>
            <h3>Register the strikes</h3>
            <p>
              Any member can list the 93 call, the 82 put, the 87 straddle. Each market gets a
              ladder — quote it, hit it, lift it.
            </p>
          </div>
          <div className="rule-card">
            <div className="rule-num">RULE 03</div>
            <h3>Every print is real</h3>
            <p>
              Trades cross on the ladder, print on the ticker, and email both counterparties a TRADE
              NOTIFICATION. Your exposure chart moves live.
            </p>
          </div>
          <div className="rule-card">
            <div className="rule-num">RULE 04</div>
            <h3>The operator settles</h3>
            <p>
              The official count goes in, the reckoning prints itself: who owes whom, on which
              trades, to the penny.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
