import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { redis, userByIdKey, userKey } from "@/lib/redis";
import { createSession, hashPassword, type StoredUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName } = await req.json();
    const emailLower = String(email || "").trim().toLowerCase();
    const pw = String(password || "");
    if (!emailLower || !emailLower.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    if (pw.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    const existing = await redis.get<StoredUser>(userKey(emailLower));
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }
    const user: StoredUser = {
      id: uuid(),
      email: emailLower,
      displayName: String(displayName || "").trim() || emailLower.split("@")[0],
      passHash: hashPassword(pw),
      createdAt: Date.now(),
    };
    await redis.set(userKey(emailLower), JSON.stringify(user));
    await redis.set(userByIdKey(user.id), emailLower);
    await createSession(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
