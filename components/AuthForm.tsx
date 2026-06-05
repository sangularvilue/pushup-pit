"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register" ? { email, password, displayName } : { email, password }
        ),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Something went wrong.");
      router.push("/pit");
      router.refresh();
    } catch (e2) {
      setErr(String((e2 as Error).message || e2));
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="ticket auth-card" onSubmit={submit}>
        <div className="ticket-head">
          <span className="ticket-title">
            {mode === "login" ? "Member Entrance" : "Badge Application"}
          </span>
        </div>
        <div className="ticket-body">
          {mode === "register" && (
            <div className="field">
              <label className="flabel">Pit name</label>
              <input
                className="finput"
                placeholder="Big Will"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}
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
          <div className="field">
            <label className="flabel">Password</label>
            <input
              className="finput"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
            />
          </div>
          {err && <div className="error-text">{err}</div>}
          <button type="submit" className="btn btn-ink btn-big" disabled={busy}>
            {busy ? "Checking the badge…" : mode === "login" ? "Step into the pit" : "Issue my badge"}
          </button>
          <div className="auth-foot">
            {mode === "login" ? (
              <>
                No badge yet? <Link href="/register">Apply here</Link>.
              </>
            ) : (
              <>
                Already a member? <Link href="/login">Sign in</Link>.
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
