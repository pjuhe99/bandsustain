import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await clearSessionCookie();
  const url = new URL("/admin/login", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
