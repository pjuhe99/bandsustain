// src/app/playground/mbti-band-casting/share/[data]/opengraph-image.tsx
import { decodeCasting } from "@/lib/mbtiCasting/share";
import { OG_SIZE, renderCastingImage } from "@/lib/mbtiCasting/shareImage";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = OG_SIZE;
export const alt = "MBTI 밴드 캐스팅 — 밴드 서스테인";

export default async function Image({ params }: { params: Promise<{ data: string }> }) {
  const { data } = await params;
  return renderCastingImage(decodeCasting(data), "og");
}
