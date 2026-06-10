const KO_RE = /^(\d{1,2})월\s*(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*(오전|오후)$/;
const EN_RE = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/;

const EN_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function build(y: number, mo: number, d: number, h12: number, mi: number, pm: boolean): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h12 < 1 || h12 > 12 || mi > 59) return null;
  const h = (h12 % 12) + (pm ? 12 : 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(mo)}-${p(d)}T${p(h)}:${p(mi)}:00`;
}

export function parseInstagramDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(KO_RE);
  if (m) {
    return build(+m[3], +m[1], +m[2], +m[4], +m[5], m[6] === "오후");
  }
  m = s.match(EN_RE);
  if (m) {
    const mo = EN_MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    return build(+m[3], mo, +m[2], +m[4], +m[5], m[6].toLowerCase() === "p");
  }
  return null;
}
