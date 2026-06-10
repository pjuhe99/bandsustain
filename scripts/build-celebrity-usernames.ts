/**
 * 위키데이터 P2003(인스타그램 계정) 전체 명단 → 블룸필터 바이너리 생성.
 * 실행: pnpm celebs:build   (수동 — 명단 갱신 시 재실행 후 커밋)
 * 데이터 출처: QLever Wikidata SPARQL (단일 CSV ~5.4MB, 실측 38.2만 행)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createBloom, bloomAdd, serializeBloom, bloomHas } from "../src/lib/playground/instagram/bloom";

const ENDPOINT = "https://qlever.cs.uni-freiburg.de/api/wikidata";
const QUERY = "SELECT ?u WHERE { ?i <http://www.wikidata.org/prop/direct/P2003> ?u }";
const OUT_BIN = join(process.cwd(), "public/playground/instagram/celebs-v1.bin");
const OUT_META = join(process.cwd(), "public/playground/instagram/celebs-v1.meta.json");
const USERNAME_RE = /^[a-z0-9._]{1,30}$/;
const FP_RATE = 0.01;

async function main() {
  const url = `${ENDPOINT}?query=${encodeURIComponent(QUERY)}`;
  const res = await fetch(url, { headers: { Accept: "text/csv" }, redirect: "follow" });
  if (!res.ok) throw new Error(`QLever HTTP ${res.status}`);
  const csv = await res.text();

  const lines = csv.split("\n");
  let sourceCount = 0;
  const set = new Set<string>();
  for (let i = 1; i < lines.length; i++) { // 0행은 헤더 "u"
    const raw = lines[i].trim().replace(/^"|"$/g, "");
    if (!raw) continue;
    sourceCount++;
    const u = raw.replace(/^@/, "").toLowerCase();
    if (USERNAME_RE.test(u)) set.add(u);
  }
  if (set.size < 200_000) throw new Error(`too few usernames: ${set.size} — 데이터 소스 이상 의심, 산출물 미생성`);

  const filter = createBloom(set.size, FP_RATE);
  for (const u of set) bloomAdd(filter, u);
  const samples = [...set].slice(0, 3);
  for (const s of samples) {
    if (!bloomHas(filter, s)) throw new Error(`self-check failed: ${s}`);
  }

  const bin = serializeBloom(filter);
  mkdirSync(dirname(OUT_BIN), { recursive: true });
  writeFileSync(OUT_BIN, bin);
  writeFileSync(
    OUT_META,
    JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        source: "wikidata P2003 via QLever",
        sourceRows: sourceCount,
        distinctUsernames: set.size,
        m: filter.m,
        k: filter.k,
        fpRate: FP_RATE,
        bytes: bin.length,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`OK: ${set.size} usernames (source rows ${sourceCount}) → ${bin.length} bytes`);
  console.log("samples:", samples.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
