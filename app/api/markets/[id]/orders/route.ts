import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { placeOrder } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const side = body?.side === "bid" || body?.side === "offer" ? body.side : null;
  const price = Number(body?.price);
  const qty = Number(body?.qty);
  if (!side) return NextResponse.json({ error: "Side must be bid or offer." }, { status: 400 });
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "Enter a valid price." }, { status: 400 });
  }
  if (!Number.isFinite(qty) || qty <= 0 || qty > 1000) {
    return NextResponse.json({ error: "Quantity must be 1–1000." }, { status: 400 });
  }
  const result = await placeOrder(id, user.id, side, price, qty);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ fills: result.fills, resting: result.resting });
}
