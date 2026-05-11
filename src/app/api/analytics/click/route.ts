import { NextRequest, NextResponse } from "next/server";
import { logClickEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_CONTENT = new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NO_CONTENT;

    const path = typeof body.path === "string" ? body.path.slice(0, 255) : "";
    const targetUrl = typeof body.targetUrl === "string" ? body.targetUrl.slice(0, 500) : "";
    const itemType =
      typeof body.itemType === "string" && body.itemType.length > 0
        ? body.itemType.slice(0, 40)
        : null;
    const itemId =
      typeof body.itemId === "number" && Number.isInteger(body.itemId) ? body.itemId : null;

    if (!path.startsWith("/")) return NO_CONTENT;
    if (!targetUrl) return NO_CONTENT;
    if (path.startsWith("/admin") || path.startsWith("/api")) return NO_CONTENT;

    const ua = req.headers.get("user-agent") || "";
    const ip =
      (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "")
        .split(",")[0]
        .trim() || "0.0.0.0";

    await logClickEvent({ path, targetUrl, itemType, itemId, ua, ip });
  } catch {
    // never surface logging failures
  }
  return NO_CONTENT;
}
