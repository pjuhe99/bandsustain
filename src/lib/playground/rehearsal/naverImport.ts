import { haversineMeters } from "./geo";

export type NaverItem = {
  id: string; name: string; full_address: string; common_address: string;
  phone: string; virtual_phone: string; booking_url: string; naver_map_url: string;
  x: string; y: string;
};
export type ExistingStudioRef = { name: string; lat: number; lng: number };
export type NaverImportStudio = {
  name: string; slug: string; areaLabel: string; roadAddress: string;
  lat: number; lng: number; mapUrl: string; bookingUrl: string | null;
  phone: string | null; bookingMethod: string | null;
};
export type NaverImportResult = {
  studios: NaverImportStudio[];
  skipped: { name: string; matchedExisting: string; by: "coord" | "name" }[];
};

const DUP_COORD_METERS = 25; // 같은 건물(0m)만 잡고 인접 별도 지점(~38m)은 살림

export function normalizeName(s: string): string {
  return s.replace(/\s|합주실/g, "");
}

export function areaLabelFromAddress(commonAddress: string, fullAddress: string): string {
  const toks = (commonAddress.trim() || fullAddress.trim()).split(/\s+/);
  const city = (toks[0] ?? "").replace(/(특별시|광역시)$/, "");
  const dong = toks[2] && /[가-힣]\d*(동|가)\d*$/.test(toks[2]) ? toks[2] : toks[1] ?? "";
  return `${city}, ${dong}`;
}

function nameDup(a: string, b: string): boolean {
  const na = normalizeName(a), nb = normalizeName(b);
  if (na === nb) return true;
  if (na.length < 4 || nb.length < 4) return false;
  const [long, short] = na.length >= nb.length ? [na, nb] : [nb, na];
  if (!long.includes(short)) return false;
  // 포함이어도 나머지에 지점 표식(숫자·'점')이 있으면 별도 지점 (성신여대점·2호점 등). 'S룸' 같은 룸 표기만 다르면 dup.
  const rest = long.replace(short, "");
  return !/[0-9점]/.test(rest);
}

export function transformNaverItems(items: NaverItem[], existing: ExistingStudioRef[]): NaverImportResult {
  const studios: NaverImportStudio[] = [];
  const skipped: NaverImportResult["skipped"] = [];
  const refs: ExistingStudioRef[] = [...existing];
  for (const it of items) {
    const lat = Number(it.y), lng = Number(it.x);
    const coordHit = refs.find((r) => haversineMeters({ lat, lng }, { lat: r.lat, lng: r.lng }) < DUP_COORD_METERS);
    const nameHit = coordHit ? null : refs.find((r) => nameDup(it.name, r.name));
    const hit = coordHit ?? nameHit;
    if (hit) {
      skipped.push({ name: it.name, matchedExisting: hit.name, by: coordHit ? "coord" : "name" });
      continue;
    }
    const phone = it.phone.trim() || it.virtual_phone.trim() || null;
    const bookingUrl = it.booking_url.trim() || null;
    studios.push({
      name: it.name.trim(), slug: `naver-${it.id}`,
      areaLabel: areaLabelFromAddress(it.common_address ?? "", it.full_address ?? ""),
      roadAddress: it.full_address.trim(), lat, lng,
      mapUrl: it.naver_map_url.trim(), bookingUrl, phone,
      bookingMethod: bookingUrl ? "네이버 예약" : phone ? "전화" : null,
    });
    refs.push({ name: it.name, lat, lng });
  }
  return { studios, skipped };
}
