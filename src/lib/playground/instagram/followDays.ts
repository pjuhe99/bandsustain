const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

// iso: "YYYY-MM-DD..." (naive). 팔로우 당일 = 1일째. 미래/파싱불가 = null.
export function followDayCount(iso: string, today: Date = new Date()): number | null {
  const m = iso.match(ISO_DATE_RE);
  if (!m) return null;
  const start = new Date(+m[1], +m[2] - 1, +m[3]); // 로컬 자정
  if (start.getFullYear() !== +m[1] || start.getMonth() !== +m[2] - 1) return null;
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return diff < 0 ? null : diff + 1;
}

export function formatKoreanDate(iso: string): string | null {
  const m = iso.match(ISO_DATE_RE);
  if (!m) return null;
  return `${+m[1]}년 ${+m[2]}월 ${+m[3]}일`;
}
