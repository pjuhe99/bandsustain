import { NextRequest, NextResponse } from "next/server";
import { canCommentOnPost, incrementViewCount } from "@/lib/columns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = new NextResponse(null, { status: 204 });
  try {
    const { id } = await params;
    const numId = Number(id);
    if (!Number.isInteger(numId)) return res;
    if (!(await canCommentOnPost(numId))) return res; // only public posts count
    const key = `col_v_${numId}`;
    if (req.cookies.get(key)) return res; // already counted recently
    await incrementViewCount(numId);
    res.cookies.set(key, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 6,
    });
  } catch {
    // never surface view tracking as an error
  }
  return res;
}
