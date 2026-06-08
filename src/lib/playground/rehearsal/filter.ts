import type { Studio, RoomEquipmentType } from "./types";

export type PriceBucket = "u15" | "15_20" | "20_25" | "o25";
export type StudioFilter = {
  province: string | null;
  subRegions: string[];
  instrumentTypes: RoomEquipmentType[];
  priceBucket: PriceBucket | null;
  capacityMin: number | null;
  parkingOnly: boolean;
  rentalOnly: boolean;
};
export type FilterResult = { studios: Studio[]; noInfo: Studio[] };

// regionName("서울 마포구") → 시도 + 하위(구/시). 지역 매칭의 단일 진실원.
export function splitRegionName(regionName: string | null): { province: string | null; sub: string | null } {
  if (!regionName) return { province: null, sub: null };
  const i = regionName.indexOf(" ");
  if (i < 0) return { province: regionName, sub: null };
  return { province: regionName.slice(0, i), sub: regionName.slice(i + 1) };
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
    const { province, sub } = splitRegionName(s.regionName);
    if (f.province && province !== f.province) continue;
    if (f.subRegions.length && (sub == null || !f.subRegions.includes(sub))) continue;
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
