import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCommentAuthRow, deleteCommentById } from "@/lib/columns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ cid: string }> },
) {
  const { cid } = await params;
  const numId = Number(cid);
  if (!Number.isInteger(numId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const password = json && typeof json.password === "string" ? json.password : "";

  const row = await getCommentAuthRow(numId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!row.passwordHash) {
    return NextResponse.json({ error: "삭제할 수 없는 댓글입니다." }, { status: 403 });
  }
  const ok = await bcrypt.compare(password, row.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 403 });
  }
  await deleteCommentById(numId);
  return NextResponse.json({ ok: true });
}
