import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  return NextResponse.json({
    user: user ? { ...user, isAdmin: isAdminEmail(user.email) } : null,
  });
}
