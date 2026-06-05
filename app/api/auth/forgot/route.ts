import { NextRequest, NextResponse } from "next/server";
import { redis, resetKey, userKey } from "@/lib/redis";
import { baseUrl, sendEmail } from "@/lib/email";
import type { StoredUser } from "@/lib/auth";

export const runtime = "nodejs";

const RESET_TTL = 60 * 60; // 1 hour

function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => "0123456789abcdefghijklmnopqrstuvwxyz"[b % 36])
    .join("");
}

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  const emailLower = String(email || "").trim().toLowerCase();
  const generic = { ok: true } as Record<string, unknown>;

  const user = await redis.get<StoredUser>(userKey(emailLower));
  // Always respond the same way so we don't leak which emails are registered.
  if (!user) return NextResponse.json(generic);

  const tok = token();
  await redis.set(
    resetKey(tok),
    { uid: user.id, exp: Date.now() + RESET_TTL * 1000 },
    { ex: RESET_TTL }
  );
  const link = `${baseUrl(req.url)}/reset/${tok}`;

  const result = await sendEmail({
    to: emailLower,
    subject: "Reset your Pushup Pit password",
    text: `Reset your Pushup Pit password using this link (valid for 1 hour):\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>Reset your <strong>Pushup Pit</strong> password using the link below (valid for 1 hour):</p>
<p><a href="${link}">${link}</a></p>
<p style="color:#888">If you didn't request this, you can safely ignore this email.</p>`,
  });

  // In dev (no provider configured) expose the link so it can be tested.
  if (!result.delivered && process.env.NODE_ENV !== "production") {
    generic.devLink = link;
  }
  return NextResponse.json(generic);
}
