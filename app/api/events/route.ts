import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { createEvent, listEvents } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const events = await listEvents();
  return NextResponse.json({ events, isAdmin: isAdminEmail(user.email) });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json(
      { error: "Only the exchange operator can list events." },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim().slice(0, 120);
  if (!name) {
    return NextResponse.json({ error: "Event name is required." }, { status: 400 });
  }
  const tickValue = Number(body?.tickValue);
  const ev = await createEvent({
    name,
    description: String(body?.description || "").slice(0, 500) || undefined,
    unit: String(body?.unit || "pushup").trim().slice(0, 30) || "pushup",
    tickValue: Number.isFinite(tickValue) && tickValue > 0 ? tickValue : 1,
    createdBy: user.id,
  });
  return NextResponse.json({ event: ev });
}
