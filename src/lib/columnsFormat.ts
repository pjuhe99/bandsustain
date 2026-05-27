// Pure formatting helpers for the columns feature. No DB / server-only imports
// so this module can be unit-tested directly with `tsx --test`.

export function maskIp(ip: string): string {
  const v = (ip || "").trim();
  if (!v) return "?";
  const v4 = v.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}`;
  if (v.includes(":")) {
    const groups = v.split(":").filter(Boolean);
    if (groups.length >= 2) return `${groups[0]}:${groups[1]}`;
    if (groups.length === 1) return groups[0];
    return "?";
  }
  return v.split(".")[0] || "?";
}

export function excerptFromMarkdown(body: string, max: number): string {
  const plain = (body || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/[*_~`#>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (max <= 0) return "";
  if (plain.length <= max) return plain;
  if (max <= 3) return plain.slice(0, max);
  return `${plain.slice(0, max - 3).trimEnd()}...`;
}

export function formatColumnDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function timeAgo(date: Date, now: Date = new Date()): string {
  const sec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (sec < 60) return "방금 전";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return formatColumnDate(date);
}
