import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { addManualTrade, getEvent } from "@/lib/store";

export const runtime = "nodejs";

/** Log an off-exchange (open-outcry) trade against your own exposure. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ev = await getEvent(id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const result = await addManualTrade(id, user.id, body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ trade: result });
}
