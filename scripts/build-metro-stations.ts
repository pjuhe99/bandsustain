/**
 * 합주실 추천용 수도권 지하철 역 데이터 빌드 스크립트.
 *
 * 두 공개 소스를 결합 — 좌표는 A, 호선 멤버십은 A∪B:
 *   A (좌표 기준): jhj0517 gist korean-subway-station-list.json5
 *       https://gist.github.com/jhj0517/9bd253175c4410493af024d5e0a1c01f
 *       전 역 좌표 보유·현대 호선명. 단 환승역 호선 멤버십 일부 누락.
 *   B (호선 보강): MountainNine/seoul-metro-map station_coordinate.csv
 *       (line,name,code,lat,lng). 환승역 호선 멤버십 정확. 표기 옛 방식·좌표 일부 오류 → 좌표는 매칭에만 쓰고 채택 안 함.
 * 취득일: 2026-06-04 (A RAW URL 은 불변 commit SHA 고정; B RAW URL 도 commit 7f98ea7 고정).
 *
 * 산출: src/lib/playground/rehearsal/data/metro-stations.json
 *   { id, name, lines[], lat, lng, area, ambiguous }[]  (수도권 ~657역, 24호선)
 *
 * 실행: cd <repo> && sudo -u ec2-user npx tsx scripts/build-metro-stations.ts
 * 런타임 네트워크 의존 없음 — 산출 JSON 커밋 후 앱은 정적 파일만 읽는다.
 */
import JSON5 from "json5";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const A_URL =
  "https://gist.githubusercontent.com/jhj0517/9bd253175c4410493af024d5e0a1c01f/raw/4a71b4b16ee2a25737acd1fdc595b7b8824a0dd1/korean-subway-station-list.json5";
const B_URL =
  "https://raw.githubusercontent.com/MountainNine/seoul-metro-map/7f98ea73f70785900024f5db107a10695e750adb/station_coordinate.csv";

// A 호선명 정규화 (오기/표기흔들림 → 정식)
const A_LINE_FIX: Record<string, string> = {
  "경의중앙": "경의중앙선",
  "김포 골드라인": "김포골드라인",
  "신림역": "신림선",
};
// B 호선명 정규화 (옛 표기 → 정식)
const B_LINE_FIX: Record<string, string> = {
  "경의선": "경의중앙선",
  "분당선": "수인분당선",
  "수인선": "수인분당선",
  "인천선": "인천1호선",
  "김포도시철도": "김포골드라인",
  "용인경전철": "에버라인",
  "의정부경전철": "의정부선",
  "우이신설경전철": "우이신설선",
};
function normBLine(l: string): string {
  const m = l.match(/^0(\d호선)$/); // 02호선 -> 2호선
  if (m) return m[1];
  return B_LINE_FIX[l] ?? l;
}

type ASrc = { name: string; areas?: string[]; lines: string[]; lat: number; lng: number };
type Rec = { lines: Set<string>; lat: number; lng: number; area: string };
type Base = { name: string; lines: Set<string>; lat: number; lng: number; area: string };
type Station = { id: string; name: string; lines: string[]; lat: number; lng: number; area: string; ambiguous: boolean };

const inMetro = (lat: number, lng: number) => lat > 36.7 && lat < 38.3 && lng > 126.2 && lng < 127.8;
const stripStation = (n: string) => (n.endsWith("역") ? n.slice(0, -1) : n);

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function pushByName(map: Map<string, Rec[]>, name: string, rec: Rec): void {
  const arr = map.get(name);
  if (arr) arr.push(rec); else map.set(name, [rec]);
}

// name 그룹을 <1.5km 러닝-centroid 군집으로 묶어 Base[] 생성 (lines 합집합, 좌표 평균, area=비어있지 않은 첫 값)
function clusterToBase(byName: Map<string, Rec[]>): Base[] {
  const out: Base[] = [];
  for (const [name, es] of byName) {
    const clusters: Rec[][] = [];
    for (const e of es) {
      const c = clusters.find((cl) => {
        const cLat = cl.reduce((s, m) => s + m.lat, 0) / cl.length;
        const cLng = cl.reduce((s, m) => s + m.lng, 0) / cl.length;
        return haversineKm([cLat, cLng], [e.lat, e.lng]) < 1.5;
      });
      if (c) c.push(e); else clusters.push([e]);
    }
    for (const cl of clusters) {
      out.push({
        name,
        lines: new Set(cl.flatMap((e) => [...e.lines])),
        lat: cl.reduce((s, e) => s + e.lat, 0) / cl.length,
        lng: cl.reduce((s, e) => s + e.lng, 0) / cl.length,
        area: cl.find((e) => e.area)?.area ?? "",
      });
    }
  }
  return out;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed (${res.status}): ${url}`);
  return res.text();
}

async function main() {
  // --- A: 좌표 기준 base ---
  const aRaw = JSON5.parse(await fetchText(A_URL)) as ASrc[];
  const aByName = new Map<string, Rec[]>();
  for (const d of aRaw) {
    const lat = Number(d.lat), lng = Number(d.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inMetro(lat, lng)) continue;
    const lines = new Set(d.lines.map((l) => A_LINE_FIX[l] ?? l));
    pushByName(aByName, stripStation(d.name), { lines, lat, lng, area: d.areas?.[0] ?? "" });
  }
  const base = clusterToBase(aByName);
  const baseByName = new Map<string, Base[]>();
  for (const b of base) { const a = baseByName.get(b.name); if (a) a.push(b); else baseByName.set(b.name, [b]); }

  // --- B: 호선 보강 (B 좌표는 매칭용으로만, 채택 안 함) ---
  const bRows = (await fetchText(B_URL)).replace(/^﻿/, "").trim().split(/\r?\n/);
  bRows.shift(); // header: line,name,code,lat,lng
  const bOnly = new Map<string, Rec[]>();
  for (const row of bRows) {
    const cols = row.split(",");
    if (cols.length < 5) continue;
    const line = normBLine(cols[0].trim());
    const name = stripStation(cols[1].trim());
    const lat = Number(cols[3]), lng = Number(cols[4]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inMetro(lat, lng)) continue;
    const cands = baseByName.get(name);
    if (cands && cands.length === 1) {
      cands[0].lines.add(line);
    } else if (cands && cands.length > 1) {
      let best = cands[0], bd = Infinity;
      for (const c of cands) { const d = haversineKm([c.lat, c.lng], [lat, lng]); if (d < bd) { bd = d; best = c; } }
      best.lines.add(line);
    } else {
      pushByName(bOnly, name, { lines: new Set([line]), lat, lng, area: "" });
    }
  }
  base.push(...clusterToBase(bOnly));

  // --- id / ambiguous ---
  const nameCount = new Map<string, number>();
  for (const b of base) nameCount.set(b.name, (nameCount.get(b.name) ?? 0) + 1);
  const out: Station[] = base
    .map((b) => {
      const ambiguous = (nameCount.get(b.name) ?? 0) > 1;
      return {
        id: ambiguous ? `${b.name}#${b.area}` : b.name,
        name: b.name,
        lines: [...b.lines].sort((x, y) => x.localeCompare(y, "ko")),
        lat: Number(b.lat.toFixed(6)),
        lng: Number(b.lng.toFixed(6)),
        area: b.area,
        ambiguous,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id, "ko"));

  // --- 무결성 가드 (위반 시 빌드 실패) ---
  const seen = new Set<string>();
  for (const s of out) {
    if (seen.has(s.id)) throw new Error(`duplicate id: "${s.id}"`);
    seen.add(s.id);
  }
  const ids = out.map((s) => s.id);
  for (const s of out) {
    if (!(s.lat >= 33 && s.lat <= 39 && s.lng >= 124 && s.lng <= 132)) throw new Error(`coord OOR: ${s.id}`);
    if (s.lines.length === 0) throw new Error(`no lines: ${s.id}`);
  }
  if (out.length < 600) throw new Error(`too few stations: ${out.length}`);
  const allLines = [...new Set(out.flatMap((s) => s.lines))].sort((a, b) => a.localeCompare(b, "ko"));
  if (allLines.length !== 24) throw new Error(`expected 24 lines, got ${allLines.length}: ${allLines.join(",")}`);

  const dest = resolve(__dirname, "../src/lib/playground/rehearsal/data/metro-stations.json");
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n", "utf-8");
  console.log(`wrote ${out.length} stations, ${allLines.length} lines -> ${dest}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
