"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import SiteHeaderStatic from "@/components/SiteHeaderStatic";
import Ticker from "@/components/Ticker";

export default function ResetPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Reset failed.");
      router.push("/pit");
      router.refresh();
    } catch (e2) {
      setErr(String((e2 as Error).message || e2));
      setBusy(false);
    }
  }

  return (
    <>
      <Ticker />
      <SiteHeaderStatic />
      <main>
        <div className="auth-wrap">
          <form className="ticket auth-card" onSubmit={submit}>
            <div className="ticket-head">
              <span className="ticket-title">New Badge Combination</span>
            </div>
            <div className="ticket-body">
              <div className="field">
                <label className="flabel">New password</label>
                <input
                  className="finput"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {err && <div className="error-text">{err}</div>}
              <button type="submit" className="btn btn-ink btn-big" disabled={busy}>
                {busy ? "Stamping…" : "Reset & sign in"}
              </button>
              <div className="auth-foot">
                <Link href="/login">Back to sign in</Link>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
