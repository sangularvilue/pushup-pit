"use client";

import Link from "next/link";
import { useState } from "react";
import SiteHeaderStatic from "@/components/SiteHeaderStatic";
import Ticker from "@/components/Ticker";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await r.json().catch(() => ({}));
    setDevLink(data?.devLink || "");
    setSent(true);
    setBusy(false);
  }

  return (
    <>
      <Ticker />
      <SiteHeaderStatic />
      <main>
        <div className="auth-wrap">
          <form className="ticket auth-card" onSubmit={submit}>
            <div className="ticket-head">
              <span className="ticket-title">Lost Badge Desk</span>
            </div>
            <div className="ticket-body">
              {sent ? (
                <>
                  <p style={{ margin: 0, fontSize: 14 }}>
                    If that email has an account, a reset link is on its way. It&apos;s valid for one
                    hour.
                  </p>
                  {devLink && (
                    <p className="num" style={{ fontSize: 12 }}>
                      dev link: <a href={devLink}>{devLink}</a>
                    </p>
                  )}
                  <div className="auth-foot">
                    <Link href="/login">Back to sign in</Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label className="flabel">Email</label>
                    <input
                      className="finput"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-ink btn-big" disabled={busy}>
                    {busy ? "Checking the records…" : "Send reset link"}
                  </button>
                  <div className="auth-foot">
                    Remembered it? <Link href="/login">Sign in</Link>.
                  </div>
                </>
              )}
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
