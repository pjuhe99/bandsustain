/**
 * 네이버 지도 스크랩 JSON → studios 적재. source_note='naver-map-import' 행만 교체(추가형 멱등) — notion-import 20곳 불변.
 * 실행(DEV): cd <repo> && sudo -u ec2-user bash -c 'set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a; npx tsx scripts/import-naver-studios.ts'
 * PROD 는 사용자 명시 요청 후: PROD .db_credentials source + ALLOW_PROD=1.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformNaverItems, type NaverItem, type ExistingStudioRef } from "../src/lib/playground/rehearsal/naverImport";

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
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM playground_studios WHERE source_note = 'naver-map-import'");
    const [rows]: any = await conn.query("SELECT name, lat, lng FROM playground_studios WHERE lat IS NOT NULL AND lng IS NOT NULL");
    const existing: ExistingStudioRef[] = rows.map((r: any) => ({ name: r.name, lat: Number(r.lat), lng: Number(r.lng) }));
    const { studios, skipped } = transformNaverItems(raw.items, existing);
    for (const s of studios) {
      await conn.query(
        `INSERT INTO playground_studios
           (name, slug, area_label, road_address, phone, lat, lng, status, source_note, map_url, booking_url, booking_method, image_url)
         VALUES (?,?,?,?,?,?,?, 'approved', 'naver-map-import', ?,?,?,?)`,
        [s.name, s.slug, s.areaLabel, s.roadAddress, s.phone, s.lat, s.lng, s.mapUrl, s.bookingUrl, s.bookingMethod, s.imageUrl],
      );
    }
    await conn.commit();
    console.log(`적재 완료(DB=${DB_NAME}): 신규 ${studios.length}곳, 중복 스킵 ${skipped.length}곳.`);
    for (const sk of skipped) console.log(`  skip [${sk.by}] ${sk.name} = 기존 '${sk.matchedExisting}'`);
  } catch (e) { await conn.rollback(); throw e; }
  finally { await conn.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
