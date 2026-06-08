/**
 * region_id 가 NULL 인 합주실에 지역(playground_regions)을 upsert+연결.
 * 도출 우선순위: road_address(전체주소) → area_label. naver import 는 자체적으로 region 을 채우므로,
 * 이 스크립트는 주로 notion-import 등 import 파이프라인 밖의 행을 보정 (멱등, 재실행 안전).
 * 실행(DEV): cd <repo> && sudo -u ec2-user bash -c 'set -a; source <DEV>/.db_credentials; set +a; npx tsx scripts/backfill-studio-regions.ts'
 * PROD: PROD .db_credentials + ALLOW_PROD=1.
 */
import mysql from "mysql2/promise";
import { regionFromAddress } from "../src/lib/playground/rehearsal/region";

async function main() {
  const DB_NAME = process.env.DB_NAME ?? "";
  if (!/DEV/i.test(DB_NAME) && process.env.ALLOW_PROD !== "1")
    throw new Error(`거부: DEV DB 아님 (DB_NAME='${DB_NAME}'). DEV .db_credentials 를 source 하거나 ALLOW_PROD=1.`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1", user: process.env.DB_USER, password: process.env.DB_PASS,
    database: DB_NAME, charset: "utf8mb4", multipleStatements: false,
  });
  const regionCache = new Map<string, number>();
  async function upsertRegion(province: string, city: string | null, district: string | null, displayName: string): Promise<number> {
    const cached = regionCache.get(displayName);
    if (cached) return cached;
    const [res]: any = await conn.query(
      `INSERT INTO playground_regions (province, city, district, display_name, is_supported, sort_order)
       VALUES (?,?,?,?,1,0)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [province, city, district, displayName],
    );
    const id = res.insertId as number;
    regionCache.set(displayName, id);
    return id;
  }

  try {
    await conn.beginTransaction();
    const [rows]: any = await conn.query(
      "SELECT id, name, area_label, road_address FROM playground_studios WHERE region_id IS NULL",
    );
    let linked = 0; const unresolved: { name: string; area_label: string }[] = [];
    for (const r of rows) {
      const region = regionFromAddress(r.road_address) ?? regionFromAddress(r.area_label);
      if (!region) { unresolved.push({ name: r.name, area_label: r.area_label }); continue; }
      const regionId = await upsertRegion(region.province, region.city, region.district, region.displayName);
      await conn.query("UPDATE playground_studios SET region_id = ? WHERE id = ?", [regionId, r.id]);
      linked++;
    }
    await conn.commit();
    console.log(`보정 완료(DB=${DB_NAME}): region 연결 ${linked}곳, regions ${regionCache.size}종, 미해결 ${unresolved.length}곳`);
    for (const u of unresolved) console.log(`  미해결: ${u.name} (area_label='${u.area_label}')`);
  } catch (e) { await conn.rollback(); throw e; }
  finally { await conn.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
