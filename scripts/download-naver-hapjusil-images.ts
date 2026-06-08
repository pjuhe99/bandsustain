/**
 * 네이버 합주실 데이터(JSON) → 서버에 CSV/JSON 저장 + 이미지 다운로드 (내부 저장 전용, 게시 보류).
 *
 * 입력 : SRC (기본 = 사용자 제공 JSON)
 * 출력 (앱 루트 기준):
 *   data/naver_hapjusil_exact_only_20260608.json            (기본 데이터, image_path 없음)
 *   data/naver_hapjusil_exact_only_20260608.csv
 *   data/naver_hapjusil_exact_only_20260608_images.csv      (이미지 다운로드 매니페스트)
 *   data/naver_hapjusil_exact_only_20260608_with_images.json (기본 + image_path)
 *   data/naver_hapjusil_exact_only_20260608_with_images.csv
 *   public/images/naver-hapjusil/{id}.{ext}                  (다운로드 이미지)
 *   logs/naver_hapjusil_image_download_failures.csv          (실패 기록)
 *
 * 실행(ec2-user 소유로 생성되도록): cd <repo> && sudo -u ec2-user npx tsx scripts/download-naver-hapjusil-images.ts
 */
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const APP_ROOT = resolve(__dirname, "..");

const SRC = process.env.SRC ?? "/var/www/html/_______site_BANDSUSTAIN/naver_hapjusil_exact_only_20260608.json";
const STEM = "naver_hapjusil_exact_only_20260608";
const DATA_DIR = join(APP_ROOT, "data");
const LOG_DIR = join(APP_ROOT, "logs");
const IMG_DIR = join(APP_ROOT, "public/images/naver-hapjusil");
const IMG_URL_BASE = "/images/naver-hapjusil";

// 스펙에 명시된 기본 컬럼
const COLUMNS = [
  "id", "name", "naver_map_url", "category", "area_label",
  "road_address", "booking_url", "longitude", "latitude", "image_url",
] as const;
type Col = (typeof COLUMNS)[number];
type Row = Record<Col, string> & { image_path?: string };

const EXT_SET = new Set(["jpg", "png", "webp", "gif"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 100 + Math.floor(((Date.now() % 7) / 7) * 200); // 100~300ms (Math.random 미사용)

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  return lines.join("\n") + "\n";
}

// 실제 바이트(매직)로 포맷 판별 — 네이버가 .jpg URL 로 png/gif 를 내려주는 경우가 있어 URL 확장자는 신뢰 불가.
function extFromMagic(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length >= 4 && buf.toString("ascii", 0, 3) === "GIF") return "gif";
  return null;
}
function extFromContentType(ct: string | null): string | null {
  if (!ct) return null;
  const c = ct.toLowerCase();
  if (c.includes("jpeg") || c.includes("jpg")) return "jpg";
  if (c.includes("png")) return "png";
  if (c.includes("webp")) return "webp";
  if (c.includes("gif")) return "gif";
  return null;
}
function extFromUrl(url: string): string | null {
  const m = url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  if (!m) return null;
  const e = m[1].toLowerCase();
  return e === "jpeg" ? "jpg" : EXT_SET.has(e) ? e : null;
}
function existingPathForId(id: string): { ext: string; abs: string } | null {
  for (const ext of EXT_SET) {
    const abs = join(IMG_DIR, `${id}.${ext}`);
    if (existsSync(abs)) return { ext, abs };
  }
  return null;
}

async function fetchImage(url: string): Promise<{ buf: Buffer; ext: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Referer": "https://map.naver.com/",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error("empty body");
    // 실제 바이트 우선 → Content-Type → URL 확장자 → 기본 jpg
    const ext = extFromMagic(buf) ?? extFromContentType(res.headers.get("content-type")) ?? extFromUrl(url) ?? "jpg";
    return { buf, ext };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const srcRaw = JSON.parse(await readFile(SRC, "utf-8"));
  const srcItems: Record<string, unknown>[] = Array.isArray(srcRaw) ? srcRaw : (srcRaw.items ?? srcRaw.data ?? []);
  for (const d of [DATA_DIR, LOG_DIR, IMG_DIR]) mkdirSync(d, { recursive: true });

  const rows: Row[] = srcItems.map((it) => {
    const r = {} as Row;
    for (const c of COLUMNS) r[c] = it[c] == null ? "" : String(it[c]);
    return r;
  });

  // 1) 기본 데이터 저장 (image_path 없음)
  await writeFile(join(DATA_DIR, `${STEM}.json`), JSON.stringify(rows, null, 2) + "\n", "utf-8");
  await writeFile(join(DATA_DIR, `${STEM}.csv`), toCsv([...COLUMNS], rows), "utf-8");

  // 2) 이미지 다운로드
  const manifest: Record<string, string>[] = [];
  const failures: Record<string, string>[] = [];
  let downloaded = 0, skippedExisting = 0, failed = 0, noUrl = 0;

  for (const r of rows) {
    const url = r.image_url.trim();
    if (!url) { noUrl++; r.image_path = ""; manifest.push({ id: r.id, name: r.name, image_url: "", ext: "", status: "no_url", image_path: "" }); continue; }

    const have = existingPathForId(r.id);
    if (have) {
      skippedExisting++;
      r.image_path = `${IMG_URL_BASE}/${r.id}.${have.ext}`;
      manifest.push({ id: r.id, name: r.name, image_url: url, ext: have.ext, status: "exists", image_path: r.image_path });
      continue;
    }

    try {
      const { buf, ext } = await fetchImage(url);
      writeFileSync(join(IMG_DIR, `${r.id}.${ext}`), buf);
      downloaded++;
      r.image_path = `${IMG_URL_BASE}/${r.id}.${ext}`;
      manifest.push({ id: r.id, name: r.name, image_url: url, ext, status: "downloaded", image_path: r.image_path });
    } catch (e) {
      failed++;
      r.image_path = "";
      const err = e instanceof Error ? e.message : String(e);
      failures.push({ id: r.id, name: r.name, image_url: url, error: err });
      manifest.push({ id: r.id, name: r.name, image_url: url, ext: "", status: "failed", image_path: "" });
    }
    await sleep(jitter());
  }

  // 3) 매니페스트 / 실패 로그 / with_images 저장
  await writeFile(join(DATA_DIR, `${STEM}_images.csv`),
    toCsv(["id", "name", "image_url", "ext", "status", "image_path"], manifest), "utf-8");
  writeFileSync(join(LOG_DIR, "naver_hapjusil_image_download_failures.csv"),
    toCsv(["id", "name", "image_url", "error"], failures), "utf-8");
  await writeFile(join(DATA_DIR, `${STEM}_with_images.json`), JSON.stringify(rows, null, 2) + "\n", "utf-8");
  await writeFile(join(DATA_DIR, `${STEM}_with_images.csv`), toCsv([...COLUMNS, "image_path"], rows), "utf-8");

  // 4) 검증 요약
  const withImageUrl = rows.filter((r) => r.image_url.trim()).length;
  const withBooking = rows.filter((r) => r.booking_url.trim()).length;
  const withCoord = rows.filter((r) => r.longitude.trim() && r.latitude.trim()).length;
  console.log("\n===== 검증 요약 =====");
  console.log(`전체 항목 수          : ${rows.length}`);
  console.log(`image_url 있는 항목   : ${withImageUrl}  (없음 ${noUrl})`);
  console.log(`이미지 다운로드 성공  : ${downloaded}  (기존 스킵 ${skippedExisting})`);
  console.log(`이미지 다운로드 실패  : ${failed}`);
  console.log(`booking_url 있는 항목 : ${withBooking}`);
  console.log(`경도/위도 있는 항목   : ${withCoord}`);
  console.log("=====================\n");
  if (failed) console.log(`⚠️ 실패 ${failed}건 → logs/naver_hapjusil_image_download_failures.csv`);
}
main().catch((e) => { console.error(e); process.exit(1); });
