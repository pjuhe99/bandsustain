import { NextRequest, NextResponse } from "next/server";
import { logPageView } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_CONTENT = new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NO_CONTENT;

    const path = typeof body.path === "string" ? body.path.slice(0, 255) : "";
    const referrer =
      typeof body.referrer === "string" && body.referrer.length > 0
        ? body.referrer.slice(0, 500)
        : null;

    if (!path.startsWith("/")) return NO_CONTENT;
    if (path.startsWith("/admin") || path.startsWith("/api")) return NO_CONTENT;

    const ua = req.headers.get("user-agent") || "";
    const ip =
      (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "")
        .split(",")[0]
        .trim() || "0.0.0.0";
    const country = req.headers.get("cf-ipcountry");

    await logPageView({ path, ua, ip, referrer, country });
  } catch {
    // never let logging surface as a real error
  }
  return NO_CONTENT;
}
