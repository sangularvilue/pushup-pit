import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createMarket, getEvent } from "@/lib/store";
import type { Kind } from "@/lib/types";

export const runtime = "nodejs";

const REGISTRABLE: Kind[] = ["call", "put", "straddle"];

/** Any member can register a derivative market on an open event. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ev = await getEvent(id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ev.settlement != null) {
    return NextResponse.json({ error: "Event is settled." }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const kind = body?.kind as Kind;
  if (!REGISTRABLE.includes(kind)) {
    return NextResponse.json(
      { error: "Register a call, put, or straddle." },
      { status: 400 }
    );
  }
  const strike = Number(body?.strike);
  if (!Number.isFinite(strike) || strike < 0) {
    return NextResponse.json({ error: "A valid strike is required." }, { status: 400 });
  }
  const result = await createMarket(id, kind, strike, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ market: result });
}
