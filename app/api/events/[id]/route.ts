import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { deleteEvent, getEvent, sanitizeEvent, saveEvent } from "@/lib/store";

export const runtime = "nodejs";

async function load(id: string) {
  const uid = await currentUserId();
  if (!uid) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const ev = await getEvent(id);
  if (!ev) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (ev.ownerId !== uid)
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ev };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { ev, error } = await load(id);
  if (error) return error;
  return NextResponse.json({ event: ev });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { ev, error } = await load(id);
  if (error) return error;
  const body = await req.json().catch(() => null);
  const next = sanitizeEvent(body?.event ?? body, ev!);
  await saveEvent(next);
  return NextResponse.json({ event: next });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { ev, error } = await load(id);
  if (error) return error;
  await deleteEvent(ev!);
  return NextResponse.json({ ok: true });
}
