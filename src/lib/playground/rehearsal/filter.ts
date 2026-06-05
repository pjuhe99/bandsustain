import type { Studio, RoomEquipmentType } from "./types";

export type PriceBucket = "u15" | "15_20" | "20_25" | "o25";
export type StudioFilter = {
  city: string | null;
  gus: string[];
  instrumentTypes: RoomEquipmentType[];
  priceBucket: PriceBucket | null;
  capacityMin: number | null;
  parkingOnly: boolean;
  rentalOnly: boolean;
};
export type FilterResult = { studios: Studio[]; noInfo: Studio[] };

const CITIES = ["서울", "성남", "수원"] as const;

export function parseRegion(roadAddress: string | null, areaLabel: string | null): { city: string | null; gu: string | null } {
  const src = roadAddress ?? "";
  let city: string | null = null;
  if (/^서울/.test(src)) city = "서울";
  else if (/성남시/.test(src)) city = "성남";
  else if (/수원시/.test(src)) city = "수원";
  if (!city && areaLabel) {
    for (const tok of areaLabel.split(",").map((s) => s.trim())) {
      if ((CITIES as readonly string[]).includes(tok)) city = tok;
    }
  }
  const gu = src.match(/(?:^|\s)([가-힣]+구)(?=\s|$)/)?.[1] ?? null;
  return { city, gu };
}

export function priceBucketMatch(price: number | null, b: PriceBucket): boolean {
  if (price == null) return false;
  switch (b) {
    case "u15": return price <= 15000;
    case "15_20": return price > 15000 && price <= 20000;
    case "20_25": return price > 20000 && price <= 25000;
    case "o25": return price > 25000;
  }
}

export function applyStudioFilters(studios: Studio[], f: StudioFilter): FilterResult {
  const roomCondActive = f.priceBucket != null || f.capacityMin != null || f.instrumentTypes.length > 0;
  const matched: Studio[] = [];
  const noInfo: Studio[] = [];
  for (const s of studios) {
    const { city, gu } = parseRegion(s.roadAddress, s.areaLabel);
    if (f.city && city !== f.city) continue;
    if (f.gus.length && (gu == null || !f.gus.includes(gu))) continue;
    if (f.parkingOnly && !s.hasParking) continue;
    if (f.rentalOnly && !/악기대여\s*O/.test(s.amenities ?? "")) continue;
    if (roomCondActive && s.rooms.length === 0) { noInfo.push(s); continue; } // 정보 없음 → 판단불가 분리
    const ok = !roomCondActive || s.rooms.some((r) => {
      if (f.priceBucket && !priceBucketMatch(r.hourlyPrice, f.priceBucket)) return false;
      if (f.capacityMin != null && !(r.capacity != null && r.capacity >= f.capacityMin)) return false;
      if (f.instrumentTypes.length && !f.instrumentTypes.every((t) => r.equipment.some((g) => g.type === t))) return false;
      return true;
    });
    if (ok) matched.push(s);
  }
  const byPrice = (a: Studio, b: Studio) => (a.hourlyPriceMin ?? Infinity) - (b.hourlyPriceMin ?? Infinity);
  return { studios: matched.sort(byPrice), noInfo: noInfo.sort(byPrice) };
}
