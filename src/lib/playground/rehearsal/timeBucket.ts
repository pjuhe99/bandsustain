import type { TimeBucket } from "./types";

// 주입형: 테스트 가능하게 Date 를 인자로 받음
export function timeBucketFor(date: Date): TimeBucket {
  const day = date.getDay(); // 0=일,6=토
  const hour = date.getHours();
  const weekend = day === 0 || day === 6;
  if (weekend) return hour >= 18 ? "weekend_night" : "weekend_day";
  if (hour >= 22 || hour < 6) return "weekday_night";
  if (hour >= 18) return "weekday_evening";
  return "weekday_day";
}
