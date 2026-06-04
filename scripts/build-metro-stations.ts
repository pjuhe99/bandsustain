/**
 * 합주실 추천용 수도권 지하철 역 데이터 빌드 스크립트.
 *
 * 원천: jhj0517 공개 gist (역명/노선/좌표, "직접 수집·일부 부정확 가능" disclaimer).
 *   https://gist.github.com/jhj0517/9bd253175c4410493af024d5e0a1c01f
 * 취득일: 2026-06-04 (아래 RAW_URL은 불변 commit SHA 고정).
 *
 * 산출: src/lib/playground/rehearsal/data/metro-stations.json
 *   { id, name, lines[], lat, lng, area, ambiguous }[]  (수도권 ~601역, 24호선)
 *
 * 실행: cd <repo> && sudo -u ec2-user npx tsx scripts/build-metro-stations.ts
 * 런타임 네트워크 의존 없음 — 산출 JSON을 커밋하면 앱 빌드는 정적 파일만 읽는다.
 */
import JSON5 from "json5";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const RAW_URL =
  "https://gist.githubusercontent.com/jhj0517/9bd253175c4410493af024d5e0a1c01f/raw/4a71b4b16ee2a25737acd1fdc595b7b8824a0dd1/korean-subway-station-list.json5";

// 호선명 표기 정규화 (오기/표기흔들림 → 정식 노선명)
const LINE_FIX: Record<string, string> = {
  "경의중앙": "경의중앙선",
  "김포 골드라인": "김포골드라인",
  "신림역": "신림선",
};

type Src = { name: string; areas?: string[]; lines: string[]; lat: number; lng: number };
type Station = { id: string; name: string; lines: string[]; lat: number; lng: number; area: string; ambiguous: boolean };

// 수도권 bounding box (부산/대구/광주/대전 등 제외)
const inMetro = (lat: number, lng: number) =>
  lat > 36.7 && lat < 38.3 && lng > 126.2 && lng < 127.8;

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function main() {
  const res = await fetch(RAW_URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const text = await res.text();
  const raw = JSON5.parse(text) as Src[]; // 파싱 실패 시 throw → 빌드 실패(silent 금지)

  // 1) 수도권 필터 + 역명에서 후행 '역' 제거 + 호선 정규화
  type Norm = { name: string; lines: string[]; lat: number; lng: number; area: string };
  const norm: Norm[] = [];
  for (const d of raw) {
    const lat = Number(d.lat), lng = Number(d.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inMetro(lat, lng)) continue;
    const name = d.name.endsWith("역") ? d.name.slice(0, -1) : d.name;
    const lines = [...new Set(d.lines.map((l) => LINE_FIX[l] ?? l))].sort((a, b) => a.localeCompare(b, "ko"));
    norm.push({ name, lines, lat, lng, area: (d.areas?.[0] ?? "") });
  }

  // 2) 같은 name 그룹 내 <1.5km 군집 병합
  const groups = new Map<string, Norm[]>();
  for (const r of norm) (groups.get(r.name) ?? groups.set(r.name, []).get(r.name)!).push(r);

  const merged: Norm[] = [];
  for (const [, es] of groups) {
    const clusters: Norm[][] = [];
    for (const e of es) {
      const c = clusters.find((cl) => haversineKm([cl[0].lat, cl[0].lng], [e.lat, e.lng]) < 1.5);
      if (c) c.push(e); else clusters.push([e]);
    }
    for (const c of clusters) {
      const lines = [...new Set(c.flatMap((e) => e.lines))].sort((a, b) => a.localeCompare(b, "ko"));
      const lat = Number((c.reduce((s, e) => s + e.lat, 0) / c.length).toFixed(6));
      const lng = Number((c.reduce((s, e) => s + e.lng, 0) / c.length).toFixed(6));
      merged.push({ name: c[0].name, lines, lat, lng, area: c[0].area });
    }
  }

  // 3) ambiguous(동명 2곳 이상) + id 부여
  const nameCount = new Map<string, number>();
  for (const m of merged) nameCount.set(m.name, (nameCount.get(m.name) ?? 0) + 1);

  const out: Station[] = merged
    .map((m) => {
      const ambiguous = (nameCount.get(m.name) ?? 0) > 1;
      return { id: ambiguous ? `${m.name}#${m.area}` : m.name, name: m.name, lines: m.lines, lat: m.lat, lng: m.lng, area: m.area, ambiguous };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id, "ko"));

  // 4) 무결성 가드 (위반 시 빌드 실패)
  const ids = out.map((s) => s.id);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate ids");
  for (const s of out) {
    if (!(s.lat >= 33 && s.lat <= 39 && s.lng >= 124 && s.lng <= 132)) throw new Error(`coord OOR: ${s.id}`);
    if (s.lines.length === 0) throw new Error(`no lines: ${s.id}`);
  }
  if (out.length < 550) throw new Error(`too few stations: ${out.length}`);

  const dest = resolve(__dirname, "../src/lib/playground/rehearsal/data/metro-stations.json");
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n", "utf-8");
  const lineCount = new Set(out.flatMap((s) => s.lines)).size;
  console.log(`wrote ${out.length} stations, ${lineCount} lines -> ${dest}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
