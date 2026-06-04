/**
 * 노션 CSV → DEV DB 적재 (트랜잭션 교체). 멱등 재실행 가능.
 * 실행: cd <repo> && sudo -u ec2-user bash -c 'set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a; npx tsx scripts/import-rehearsal-studios.ts'
 * 안전: env(DEV .db_credentials) 연결 + DB_NAME 에 'DEV' 없으면 거부. getPool()(PROD 기본경로) 사용 안 함.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { buildStudios, type CsvRow } from "../src/lib/playground/rehearsal/studioImport";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const slugify = (s: string, i: number) =>
  "notion-" + i + "-" + s.replace(/[^a-zA-Z0-9가-힣]+/g, "-").toLowerCase().slice(0, 36);

async function main() {
  const DB_NAME = process.env.DB_NAME ?? "";
  if (!/DEV/i.test(DB_NAME)) throw new Error(`거부: DEV DB 아님 (DB_NAME='${DB_NAME}'). DEV .db_credentials 를 source 하세요.`);

  const csvPath = resolve(__dirname, "data/rehearsal-studios.csv");
  const coordsPath = resolve(__dirname, "data/rehearsal-studio-coords.json");
  const raw = parse(readFileSync(csvPath, "utf-8"), { columns: true, skip_empty_lines: true, bom: true }) as Record<string, string>[];
  const rows: CsvRow[] = raw.map((r) => ({
    name: r["합주실 이름"] ?? "", price: r["가격(시간당)"] ?? "", etc: r["기타 정보"] ?? "",
    naver: r["네이버 지도"] ?? "", capacity: r["수용 인원 (오피셜)"] ?? "", booking: r["예약 방식"] ?? "",
    location: r["위치"] ?? "", gear: r["장비"] ?? "", review: r["후기(요약)"] ?? "",
  }));
  const studios = buildStudios(rows);
  const coords = JSON.parse(readFileSync(coordsPath, "utf-8")) as Record<string, { lat: number; lng: number; roadAddress: string; homepageUrl: string | null }>;
  const missing = studios.filter((s) => !coords[s.name]);
  if (missing.length) throw new Error("coords 누락: " + missing.map((s) => s.name).join(", "));

  let etcCount = 0, gearCount = 0;
  for (const s of studios) for (const rm of s.rooms) for (const g of rm.equipment) { gearCount++; if (g.type === "ETC") etcCount++; }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1", user: process.env.DB_USER, password: process.env.DB_PASS,
    database: DB_NAME, charset: "utf8mb4", multipleStatements: false,
  });
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM playground_studios"); // CASCADE → rooms/equipment/results
    for (let idx = 0; idx < studios.length; idx++) {
      const s = studios[idx];
      const c = coords[s.name];
      const [res]: any = await conn.query(
        `INSERT INTO playground_studios
           (name, slug, area_label, road_address, lat, lng, hourly_price_min, hourly_price_max,
            min_capacity, max_capacity, has_parking, status, source_note, map_url, homepage_url, booking_method, amenities)
         VALUES (?,?,?,?,?,?,?,?,?,?,?, 'approved', 'notion-import', ?,?,?,?)`,
        [s.name, slugify(s.name, idx), s.areaLabel, c.roadAddress, c.lat, c.lng,
         s.priceMin, s.priceMax, null, s.capacityMax, s.hasParking ? 1 : 0,
         s.mapUrl, c.homepageUrl, s.bookingMethod, s.amenities],
      );
      const studioId = res.insertId;
      for (const rm of s.rooms) {
        await conn.query(
          `INSERT INTO playground_studio_rooms (studio_id, name, hourly_price, capacity, equipment_json, review, sort_order)
           VALUES (?,?,?,?,?,?,?)`,
          [studioId, rm.name, rm.hourlyPrice, rm.capacity, JSON.stringify(rm.equipment), rm.review, rm.sortOrder],
        );
      }
    }
    await conn.commit();
    console.log(`적재 완료(DB=${DB_NAME}): 합주실 ${studios.length}곳, 방 ${studios.reduce((a, s) => a + s.rooms.length, 0)}개. 장비 ${gearCount}개 중 ETC ${etcCount}개.`);
  } catch (e) { await conn.rollback(); throw e; }
  finally { await conn.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
