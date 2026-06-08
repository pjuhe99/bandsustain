import type { StudioScore } from "./scoring";

export function generateRecommendationReason(args: {
  studioName: string;
  score: StudioScore;
  hourlyPriceMin: number | null;
}): string {
  const parts: string[] = [];
  const avg = Math.round(args.score.avgMinutes);
  const max = Math.round(args.score.maxMinutes);
  parts.push(`평균 이동 ${avg}분`);

  if (args.score.spreadMinutes <= 10) parts.push("멤버 간 이동 편차가 작아 공평해요");
  else parts.push(`가장 먼 멤버도 ${max}분`);

  if (args.score.avgTransfer < 0.5) parts.push("환승 부담이 적어요");
  if (args.hourlyPriceMin != null) {
    parts.push(`시간당 ${args.hourlyPriceMin.toLocaleString("ko-KR")}원부터`);
  }
  return parts.join(" · ");
}
