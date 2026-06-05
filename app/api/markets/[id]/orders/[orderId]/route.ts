import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { cancelOrder } from "@/lib/store";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, orderId } = await params;
  const result = await cancelOrder(id, orderId, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
