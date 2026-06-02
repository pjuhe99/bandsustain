// scripts/seed-rehearsal.ts
// mock 합주실 + 장비 멱등 시드 (DEV 검증용). slug UNIQUE 기준 upsert.
//   set -a; source <DEV site>/.db_credentials; set +a
//   sudo -u ec2-user env PATH="$PATH" pnpm rehearsal:seed
import mysql from "mysql2/promise";

type SeedStudio = {
  name: string; slug: string; regionDisplay: string; areaLabel: string;
  lat: number; lng: number; nearestStation: string; nearestStationMeters: number;
  priceMin: number; priceMax: number; minCap: number; maxCap: number; hasParking: boolean;
  equipment: { type: string; name: string | null; qty: number }[];
};

const STUDIOS: SeedStudio[] = [
  { name: "합정 사운드합주실", slug: "hapjeong-sound", regionDisplay: "서울 마포구", areaLabel: "서울 마포구 합정동",
    lat: 37.5495, lng: 126.9136, nearestStation: "합정역", nearestStationMeters: 250,
    priceMin: 18000, priceMax: 25000, minCap: 1, maxCap: 8, hasParking: false,
    equipment: [{ type: "DRUM_SET", name: "Pearl Export", qty: 1 }, { type: "GUITAR_AMP", name: "JC-120", qty: 2 }, { type: "BASS_AMP", name: "Ampeg", qty: 1 }, { type: "MIC", name: "SM58", qty: 3 }] },
  { name: "강남 락스타합주실", slug: "gangnam-rockstar", regionDisplay: "서울 강남구", areaLabel: "서울 강남구 역삼동",
    lat: 37.5006, lng: 127.0364, nearestStation: "강남역", nearestStationMeters: 400,
    priceMin: 25000, priceMax: 35000, minCap: 1, maxCap: 10, hasParking: true,
    equipment: [{ type: "DRUM_SET", name: "Yamaha", qty: 1 }, { type: "GUITAR_AMP", name: "Marshall", qty: 2 }, { type: "BASS_AMP", name: "Hartke", qty: 1 }, { type: "KEYBOARD", name: "Roland", qty: 1 }, { type: "PA_SYSTEM", name: null, qty: 1 }] },
  { name: "신촌 그루브합주실", slug: "sinchon-groove", regionDisplay: "서울 서대문구", areaLabel: "서울 서대문구 창천동",
    lat: 37.5559, lng: 126.9368, nearestStation: "신촌역", nearestStationMeters: 300,
    priceMin: 16000, priceMax: 22000, minCap: 1, maxCap: 6, hasParking: false,
    equipment: [{ type: "DRUM_SET", name: null, qty: 1 }, { type: "GUITAR_AMP", name: "JC-120", qty: 1 }, { type: "BASS_AMP", name: null, qty: 1 }] },
  { name: "건대 비트합주실", slug: "kondae-beat", regionDisplay: "서울 광진구", areaLabel: "서울 광진구 화양동",
    lat: 37.5403, lng: 127.0695, nearestStation: "건대입구역", nearestStationMeters: 350,
    priceMin: 17000, priceMax: 24000, minCap: 1, maxCap: 8, hasParking: false,
    equipment: [{ type: "DRUM_SET", name: "Tama", qty: 1 }, { type: "GUITAR_AMP", name: "Fender", qty: 2 }, { type: "BASS_AMP", name: "Markbass", qty: 1 }, { type: "MIC", name: "SM58", qty: 2 }, { type: "DOUBLE_PEDAL", name: null, qty: 1 }] },
  { name: "수원역 멜로디합주실", slug: "suwon-melody", regionDisplay: "경기 수원시", areaLabel: "경기 수원시 팔달구",
    lat: 37.2659, lng: 127.0001, nearestStation: "수원역", nearestStationMeters: 500,
    priceMin: 14000, priceMax: 20000, minCap: 1, maxCap: 7, hasParking: true,
    equipment: [{ type: "DRUM_SET", name: null, qty: 1 }, { type: "GUITAR_AMP", name: "JC-120", qty: 1 }, { type: "BASS_AMP", name: null, qty: 1 }, { type: "KEYBOARD", name: null, qty: 1 }] },
  { name: "성남 모던합주실", slug: "seongnam-modern", regionDisplay: "경기 성남시", areaLabel: "경기 성남시 분당구",
    lat: 37.3827, lng: 127.1189, nearestStation: "서현역", nearestStationMeters: 600,
    priceMin: 15000, priceMax: 21000, minCap: 1, maxCap: 9, hasParking: true,
    equipment: [{ type: "DRUM_SET", name: "Pearl", qty: 1 }, { type: "GUITAR_AMP", name: "Marshall", qty: 2 }, { type: "BASS_AMP", name: "Ampeg", qty: 1 }, { type: "MIXER", name: null, qty: 1 }, { type: "MIC", name: "SM58", qty: 4 }] },
  { name: "홍대 인디합주실", slug: "hongdae-indie", regionDisplay: "서울 마포구", areaLabel: "서울 마포구 서교동",
    lat: 37.5563, lng: 126.9236, nearestStation: "홍대입구역", nearestStationMeters: 200,
    priceMin: 20000, priceMax: 28000, minCap: 1, maxCap: 8, hasParking: false,
    equipment: [{ type: "DRUM_SET", name: "DW", qty: 1 }, { type: "GUITAR_AMP", name: "Vox", qty: 2 }, { type: "BASS_AMP", name: "Aguilar", qty: 1 }, { type: "KEYBOARD", name: "Nord", qty: 1 }, { type: "PA_SYSTEM", name: null, qty: 1 }, { type: "MIC", name: "SM58", qty: 3 }] },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASS, database: process.env.DB_NAME, charset: "utf8mb4",
  });

  for (const s of STUDIOS) {
    const [regionRows] = await conn.query<any[]>(
      `SELECT id FROM playground_regions WHERE display_name = ? LIMIT 1`, [s.regionDisplay],
    );
    const regionId = regionRows[0]?.id ?? null;

    await conn.query(
      `INSERT INTO playground_studios
         (name, slug, region_id, area_label, lat, lng, nearest_station, nearest_station_meters,
          hourly_price_min, hourly_price_max, min_capacity, max_capacity, has_parking, status, source_note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'approved', 'seed-mock')
       ON DUPLICATE KEY UPDATE
         name=VALUES(name), region_id=VALUES(region_id), area_label=VALUES(area_label),
         lat=VALUES(lat), lng=VALUES(lng), nearest_station=VALUES(nearest_station),
         nearest_station_meters=VALUES(nearest_station_meters), hourly_price_min=VALUES(hourly_price_min),
         hourly_price_max=VALUES(hourly_price_max), min_capacity=VALUES(min_capacity),
         max_capacity=VALUES(max_capacity), has_parking=VALUES(has_parking), status='approved'`,
      [s.name, s.slug, regionId, s.areaLabel, s.lat, s.lng, s.nearestStation, s.nearestStationMeters,
       s.priceMin, s.priceMax, s.minCap, s.maxCap, s.hasParking ? 1 : 0],
    );
    const [studioRows] = await conn.query<any[]>(`SELECT id FROM playground_studios WHERE slug = ? LIMIT 1`, [s.slug]);
    const studioId = studioRows[0].id;
    await conn.query(`DELETE FROM playground_studio_equipment WHERE studio_id = ?`, [studioId]);
    for (const e of s.equipment) {
      await conn.query(
        `INSERT INTO playground_studio_equipment (studio_id, equipment_type, equipment_name, quantity) VALUES (?,?,?,?)`,
        [studioId, e.type, e.name, e.qty],
      );
    }
  }

  const [[counts]] = await conn.query<any>(
    `SELECT (SELECT COUNT(*) FROM playground_studios) AS studios,
            (SELECT COUNT(*) FROM playground_studio_equipment) AS equipment,
            (SELECT COUNT(*) FROM playground_regions) AS regions`,
  );
  console.log("seeded:", counts);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
