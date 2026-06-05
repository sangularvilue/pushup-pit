import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { currentUserId } from "@/lib/auth";
import { listEvents, saveEvent } from "@/lib/store";
import type { PitEvent } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const events = await listEvents(uid);
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim().slice(0, 120);
  if (!name) {
    return NextResponse.json({ error: "Contract name is required." }, { status: 400 });
  }
  const tickValue = Number(body?.tickValue);
  const now = Date.now();
  const ev: PitEvent = {
    id: uuid(),
    ownerId: uid,
    name,
    description: String(body?.description || "").slice(0, 500) || undefined,
    unit: String(body?.unit || "pushup").trim().slice(0, 30) || "pushup",
    tickValue: Number.isFinite(tickValue) && tickValue > 0 ? tickValue : 1,
    trades: [],
    settlement: undefined,
    createdAt: now,
    updatedAt: now,
  };
  await saveEvent(ev);
  return NextResponse.json({ event: ev });
}
