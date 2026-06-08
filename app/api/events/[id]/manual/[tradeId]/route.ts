import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { deleteManualTrade } from "@/lib/store";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tradeId: string }> }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, tradeId } = await params;
  await deleteManualTrade(id, user.id, tradeId);
  return NextResponse.json({ ok: true });
}
