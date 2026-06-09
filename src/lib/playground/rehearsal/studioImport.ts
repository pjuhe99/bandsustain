import { classifyGearList } from "./gearClassify";
import type { RoomGear } from "./types";

export type CsvRow = {
  name: string; price: string; etc: string; naver: string;
  capacity: string; booking: string; location: string; gear: string; review: string;
};

export type ImportRoom = {
  name: string; hourlyPrice: number | null; capacity: number | null;
  equipment: RoomGear[]; review: string | null; sortOrder: number;
};
export type ImportStudio = {
  name: string; areaLabel: string; bookingMethod: string; amenities: string;
  hasParking: boolean; mapUrl: string;
  priceMin: number | null; priceMax: number | null; capacityMax: number | null;
  rooms: ImportRoom[];
};

export function parsePrice(s: string): number | null {
  const digits = s.replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : null;
}

export function parseHasParking(etc: string): boolean {
  return /주차\s*O/.test(etc);
}

export function commonPrefix(names: string[]): string {
  if (names.length === 1) return names[0].trim();
  let p = names[0];
  for (const n of names.slice(1)) {
    let i = 0;
    while (i < p.length && i < n.length && p[i] === n[i]) i++;
    p = p.slice(0, i);
  }
  return p.trim();
}

export function buildStudios(rows: CsvRow[]): ImportStudio[] {
  // 네이버 링크로 그룹핑 (순서 보존)
  const groups = new Map<string, CsvRow[]>();
  for (const r of rows) {
    const key = r.naver.trim();
    const arr = groups.get(key);
    if (arr) arr.push(r); else groups.set(key, [r]);
  }
  const out: ImportStudio[] = [];
  for (const [naver, rs] of groups) {
    const studioName = commonPrefix(rs.map((r) => r.name));
    const rooms: ImportRoom[] = rs.map((r, i) => {
      const roomName = r.name.slice(studioName.length).trim() || "메인";
      return {
        name: roomName,
        hourlyPrice: parsePrice(r.price),
        capacity: r.capacity.trim() ? parseInt(r.capacity.replace(/[^0-9]/g, ""), 10) : null,
        equipment: classifyGearList(r.gear),
        review: r.review.trim() || null,
        sortOrder: i,
      };
    });
    const prices = rooms.map((x) => x.hourlyPrice).filter((x): x is number => x != null);
    const caps = rooms.map((x) => x.capacity).filter((x): x is number => x != null);
    out.push({
      name: studioName,
      areaLabel: rs[0].location.trim(),
      bookingMethod: rs[0].booking.trim(),
      amenities: rs[0].etc.trim(),
      hasParking: parseHasParking(rs[0].etc),
      mapUrl: naver,
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      capacityMax: caps.length ? Math.max(...caps) : null,
      rooms,
    });
  }
  return out;
}
