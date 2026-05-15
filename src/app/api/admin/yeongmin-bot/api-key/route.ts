import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { setApiKey } from "@/lib/yeongminBot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { apiKey?: unknown };
  try {
    body = (await req.json()) as { apiKey?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const apiKey = body.apiKey;
  if (typeof apiKey !== "string" || apiKey.length < 20 || apiKey.length > 200) {
    return NextResponse.json({ error: "apiKey length must be 20..200 chars" }, { status: 400 });
  }
  try {
    await setApiKey(apiKey);
  } catch (e) {
    console.error("[yeongmin-bot] setApiKey failed:", e);
    return NextResponse.json({ error: "encrypt failed (check ENCRYPTION_KEY)" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
