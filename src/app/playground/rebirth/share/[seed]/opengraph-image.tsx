import { OG_SIZE, renderRebirthShareImage } from "@/lib/rebirth/shareImage";
import { sharedRebirthResult } from "@/lib/rebirth/share";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = OG_SIZE;
export const alt = "다시 태어난다면 결과 카드";

export default async function Image({ params }: { params: Promise<{ seed: string }> }) {
  const { seed } = await params;
  return await renderRebirthShareImage(sharedRebirthResult(seed));
}
