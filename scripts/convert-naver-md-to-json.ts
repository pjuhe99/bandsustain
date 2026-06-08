/**
 * 네이버 합주실 마크다운 테이블 → import-naver-studios.ts 가 읽는 NaverItem[] JSON 으로 변환.
 * 마크다운 컬럼: rank | name | [link](지도URL) | area(=common_address) | [booking](예약URL) | "lat, lng" | phone
 * 도로명주소(road_address/full_address)는 마크다운에 없으므로, 직전 JSON 덤프에서 id 가 겹치는 곳은 이어받아 회귀 방지.
 * 실행: cd <repo> && npx tsx scripts/convert-naver-md-to-json.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const MD = resolve(__dirname, "data/naver-hapjusil-2026-06-08.md");
const PREV = resolve(__dirname, "data/naver-map-hapjusil-2026-06-04.json");
// 풍부한 원본 JSON(image_url 보유): 마크다운엔 없는 image_url 을 id 로 매칭해 채움.
const RICH = process.env.RICH ?? "/var/www/html/_______site_BANDSUSTAIN/naver_hapjusil_exact_only_20260608.json";
const OUT = resolve(__dirname, "data/naver-map-hapjusil-2026-06-08.json");

type PrevItem = { id: string; road_address?: string; full_address?: string };
const prev = JSON.parse(readFileSync(PREV, "utf-8")) as { items: PrevItem[] };
const prevById = new Map(prev.items.map((it) => [String(it.id), it]));

const richRaw = JSON.parse(readFileSync(RICH, "utf-8"));
const richItems: { id: string; image_url?: string }[] = Array.isArray(richRaw) ? richRaw : (richRaw.items ?? []);
const imageById = new Map(richItems.map((it) => [String(it.id), (it.image_url ?? "").trim()]));

const urlIn = (cell: string): string => cell.match(/\((https?:\/\/[^)]+)\)/)?.[1] ?? "";
const idFromMapUrl = (url: string): string => url.match(/place\/(\d+)/)?.[1] ?? "";

const lines = readFileSync(MD, "utf-8").split(/\r?\n/);
const items: Record<string, string>[] = [];
const problems: string[] = [];

for (const line of lines) {
  if (!line.trim().startsWith("|")) continue;
  const parts = line.split("|").map((p) => p.trim());
  // ['', rank, name, linkCell, area, bookingCell, coord, phone, '']
  const [, rank, name, linkCell, area, bookingCell, coord, phone] = parts;
  if (!/^\d+$/.test(rank ?? "")) continue; // 헤더/구분선 스킵

  const mapUrl = urlIn(linkCell ?? "");
  const id = idFromMapUrl(mapUrl);
  if (!id) { problems.push(`#${rank} ${name}: id 추출 실패 (${linkCell})`); continue; }

  const [latStr, lngStr] = (coord ?? "").split(",").map((s) => s.trim());
  const lat = Number(latStr), lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    problems.push(`#${rank} ${name}: 좌표 파싱 실패 (${coord})`); continue;
  }
  // 한국 위경도 범위 가드 (lat≈33~39, lng≈124~132) — lat/lng 뒤바뀜 검출
  if (lat < 32 || lat > 40 || lng < 123 || lng > 133) {
    problems.push(`#${rank} ${name}: 좌표 범위 밖 (lat=${lat}, lng=${lng})`); continue;
  }

  const carried = prevById.get(id);
  items.push({
    id,
    name: name ?? "",
    naver_map_url: mapUrl,
    road_address: carried?.road_address ?? "",
    full_address: carried?.full_address ?? "",
    common_address: area ?? "",
    phone: phone ?? "",
    virtual_phone: "",
    booking_url: urlIn(bookingCell ?? ""),
    image_url: imageById.get(id) ?? "",
    x: String(lng), // x=경도
    y: String(lat), // y=위도
  });
}

const carriedCount = items.filter((it) => it.full_address).length;
const out = {
  converted_at: "2026-06-08",
  source_md: "naver-hapjusil-2026-06-08.md",
  total_items: items.length,
  road_address_carried_from_prev: carriedCount,
  items,
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf-8");
console.log(`변환 완료: ${items.length}곳 → ${OUT}`);
console.log(`  도로명주소 이어받음(id 일치): ${carriedCount}곳`);
if (problems.length) {
  console.log(`  ⚠️ 문제 ${problems.length}건:`);
  for (const p of problems) console.log(`    - ${p}`);
}
