import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import {
  deleteEvent,
  getEvent,
  listBooks,
  listFills,
  resolveNames,
  saveEvent,
} from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ev = await getEvent(id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [books, fills] = await Promise.all([listBooks(id), listFills(id)]);
  const ids = new Set<string>();
  for (const b of books) for (const o of b.orders) ids.add(o.userId);
  for (const f of fills) {
    ids.add(f.buyerId);
    ids.add(f.sellerId);
  }
  const names = await resolveNames([...ids]);
  return NextResponse.json({
    event: ev,
    books,
    fills,
    names,
    me: user.id,
    isAdmin: isAdminEmail(user.email),
  });
}

/** Admin only: edit specs or set/clear the settlement. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json(
      { error: "Only the exchange operator can do that." },
      { status: 403 }
    );
  }
  const { id } = await params;
  const ev = await getEvent(id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  if (typeof body?.name === "string" && body.name.trim()) ev.name = body.name.trim().slice(0, 120);
  if (typeof body?.description === "string") ev.description = body.description.slice(0, 500);
  if (typeof body?.unit === "string" && body.unit.trim()) ev.unit = body.unit.trim().slice(0, 30);
  const tv = Number(body?.tickValue);
  if (Number.isFinite(tv) && tv > 0) ev.tickValue = tv;

  if ("settlement" in (body || {})) {
    if (body.settlement === null) {
      ev.settlement = null;
    } else {
      const s = Number(body.settlement);
      if (!Number.isFinite(s)) {
        return NextResponse.json({ error: "Settlement must be a number." }, { status: 400 });
      }
      ev.settlement = s;
    }
  }

  await saveEvent(ev);
  return NextResponse.json({ event: ev });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json(
      { error: "Only the exchange operator can do that." },
      { status: 403 }
    );
  }
  const { id } = await params;
  await deleteEvent(id);
  return NextResponse.json({ ok: true });
}
