import { decodeShareProfile } from "@/lib/soundTaste/share";
import { OG_SIZE, renderShareImage } from "@/lib/soundTaste/shareImage";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = OG_SIZE;
export const alt = "사운드 취향 테스트 — 밴드 서스테인";

export default async function Image({ params }: { params: Promise<{ data: string }> }) {
  const { data } = await params;
  // 디코드 실패 시에도 500 내지 않도록 helper 가 중립 카드로 폴백한다.
  return renderShareImage(decodeShareProfile(data), "og");
}
