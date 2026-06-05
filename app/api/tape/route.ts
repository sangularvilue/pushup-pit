import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listTape } from "@/lib/store";

export const runtime = "nodejs";

/** Recent real transactions for the ticker. Empty when logged out. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ tape: [] });
  const tape = await listTape();
  return NextResponse.json({ tape });
}
