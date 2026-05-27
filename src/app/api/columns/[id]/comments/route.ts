import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { commentInputSchema } from "@/lib/columnsValidation";
import { canCommentOnPost, getLatestCommentAtByIp, insertComment } from "@/lib/columns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clientIp(req: NextRequest): string {
  return (
    (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "")
      .split(",")[0]
      .trim() || "0.0.0.0"
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = commentInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값 오류" },
      { status: 400 },
    );
  }
  const { nickname, body, password, website } = parsed.data;

  // honeypot: pretend success, store nothing
  if (website && website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  if (!(await canCommentOnPost(numId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip = clientIp(req);
  const last = await getLatestCommentAtByIp(ip);
  if (last && Date.now() - last.getTime() < 15_000) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const passwordHash = password && password.length > 0 ? await bcrypt.hash(password, 10) : null;
  await insertComment({ postId: numId, nickname, body, ip, passwordHash });
  return NextResponse.json({ ok: true });
}
