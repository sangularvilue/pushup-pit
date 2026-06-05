import { NextResponse } from "next/server";
import { listTape } from "@/lib/store";

export const runtime = "nodejs";

/** Recent real transactions for the ticker — public, so the landing page
 * shows the action to people who haven't signed in yet. */
export async function GET() {
  const tape = await listTape();
  return NextResponse.json({ tape });
}
