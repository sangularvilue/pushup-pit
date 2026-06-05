import { NextRequest, NextResponse } from "next/server";
import { redis, userKey } from "@/lib/redis";
import { createSession, verifyPassword, type StoredUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const emailLower = String(email || "").trim().toLowerCase();
    const user = await redis.get<StoredUser>(userKey(emailLower));
    if (!user || !verifyPassword(String(password || ""), user.passHash)) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }
    await createSession(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
