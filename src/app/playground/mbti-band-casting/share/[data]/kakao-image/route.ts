// src/app/playground/mbti-band-casting/share/[data]/kakao-image/route.ts
import { decodeCasting } from "@/lib/mbtiCasting/share";
import { renderCastingImage } from "@/lib/mbtiCasting/shareImage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ data: string }> }) {
  const { data } = await params;
  return renderCastingImage(decodeCasting(data), "kakao");
}
