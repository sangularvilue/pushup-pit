import { NextRequest, NextResponse } from "next/server";
import { redis, resetKey, userByIdKey, userKey } from "@/lib/redis";
import { createSession, hashPassword, type StoredUser } from "@/lib/auth";
import { readReset } from "@/lib/reset";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({}));
  const tok = String(token || "");
  const pw = String(password || "");
  if (pw.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  const rec = await readReset(tok);
  if (!rec) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }
  const email = await redis.get<string>(userByIdKey(rec.uid));
  if (!email) {
    return NextResponse.json({ error: "Account not found." }, { status: 400 });
  }
  const user = await redis.get<StoredUser>(userKey(email));
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 400 });
  }
  user.passHash = hashPassword(pw);
  await redis.set(userKey(email), JSON.stringify(user));
  await redis.del(resetKey(tok));
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
