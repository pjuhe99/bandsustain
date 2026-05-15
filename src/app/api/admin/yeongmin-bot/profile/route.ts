import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { uploadImage } from "@/lib/upload";
import { updateSettings } from "@/lib/yeongminBot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const result = await uploadImage(formData, "yeongmin");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  await updateSettings({ profileImagePath: result.path });
  return NextResponse.json({ ok: true, path: result.path });
}
