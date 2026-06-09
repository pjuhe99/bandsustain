/**
 * 네이버 지도 스크랩 JSON → studios 적재. source_note='naver-map-import' 행만 교체(추가형 멱등) — notion-import 20곳 불변.
 * 실행(DEV): cd <repo> && sudo -u ec2-user bash -c 'set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a; npx tsx scripts/import-naver-studios.ts'
 * PROD 는 사용자 명시 요청 후: PROD .db_credentials source + ALLOW_PROD=1.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformNaverItems, type NaverItem, type ExistingStudioRef, type NaverImportStudio } from "../src/lib/playground/rehearsal/naverImport";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

async function main() {
  const DB_NAME = process.env.DB_NAME ?? "";
  if (!/DEV/i.test(DB_NAME) && process.env.ALLOW_PROD !== "1")
    throw new Error(`거부: DEV DB 아님 (DB_NAME='${DB_NAME}'). DEV .db_credentials 를 source 하거나 ALLOW_PROD=1.`);

  const raw = JSON.parse(readFileSync(resolve(__dirname, "data/naver-map-hapjusil-2026-06-08.json"), "utf-8")) as { items: NaverItem[] };

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1", user: process.env.DB_USER, password: process.env.DB_PASS,
    database: DB_NAME, charset: "utf8mb4", multipleStatements: false,
  });
  // 지역 upsert(멱등): display_name UNIQUE → ON DUPLICATE 로 기존/신규 id 회수. 캐시로 중복 쿼리 회피.
  const regionCache = new Map<string, number>();
  async function upsertRegion(region: NaverImportStudio["region"]): Promise<number | null> {
    if (!region) return null;
    const cached = regionCache.get(region.displayName);
    if (cached) return cached;
    const [res]: any = await conn.query(
      `INSERT INTO playground_regions (province, city, district, display_name, is_supported, sort_order)
       VALUES (?,?,?,?,1,0)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [region.province, region.city, region.district, region.displayName],
    );
    const id = res.insertId as number;
    regionCache.set(region.displayName, id);
    return id;
  }

  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM playground_studios WHERE source_note = 'naver-map-import'");
    const [rows]: any = await conn.query("SELECT name, lat, lng FROM playground_studios WHERE lat IS NOT NULL AND lng IS NOT NULL");
    const existing: ExistingStudioRef[] = rows.map((r: any) => ({ name: r.name, lat: Number(r.lat), lng: Number(r.lng) }));
    const { studios, skipped } = transformNaverItems(raw.items, existing);
    let withRegion = 0;
    for (const s of studios) {
      const regionId = await upsertRegion(s.region);
      if (regionId) withRegion++;
      await conn.query(
        `INSERT INTO playground_studios
           (name, slug, area_label, road_address, phone, lat, lng, region_id, status, source_note, map_url, booking_url, booking_method, image_url)
         VALUES (?,?,?,?,?,?,?,?, 'approved', 'naver-map-import', ?,?,?,?)`,
        [s.name, s.slug, s.areaLabel, s.roadAddress, s.phone, s.lat, s.lng, regionId, s.mapUrl, s.bookingUrl, s.bookingMethod, s.imageUrl],
      );
    }
    await conn.commit();
    console.log(`  지역 연결: ${withRegion}/${studios.length}곳 (regions 캐시 ${regionCache.size}종)`);
    console.log(`적재 완료(DB=${DB_NAME}): 신규 ${studios.length}곳, 중복 스킵 ${skipped.length}곳.`);
    for (const sk of skipped) console.log(`  skip [${sk.by}] ${sk.name} = 기존 '${sk.matchedExisting}'`);
  } catch (e) { await conn.rollback(); throw e; }
  finally { await conn.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
