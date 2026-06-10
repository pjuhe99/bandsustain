import { bloomHas, deserializeBloom, type BloomFilter } from "./bloom";

export type CelebrityVerdict = "celebrity" | "person";
export type CelebrityOverrides = Record<string, CelebrityVerdict>;

const FILTER_URL = "/playground/instagram/celebs-v1.bin";
const OVERRIDES_KEY = "bs_instagram_celebrity_overrides_v1";
const HEURISTIC_RE = /official/;

let filterPromise: Promise<BloomFilter | null> | null = null;

// 결과 화면 진입 시 1회 lazy fetch. 실패 시 null (기능 조용히 숨김 — 분석 무영향).
export function loadCelebrityFilter(): Promise<BloomFilter | null> {
  if (!filterPromise) {
    filterPromise = fetch(FILTER_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => deserializeBloom(buf))
      .catch(() => null);
  }
  return filterPromise;
}

// 우선순위: 수동 보정 > 블룸필터 > 휴리스틱
export function classify(
  username: string,
  filter: BloomFilter | null,
  overrides: CelebrityOverrides,
): CelebrityVerdict {
  const o = overrides[username];
  if (o) return o;
  if (filter && bloomHas(filter, username)) return "celebrity";
  if (HEURISTIC_RE.test(username)) return "celebrity";
  return "person";
}

export function loadOverrides(): CelebrityOverrides {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export function saveOverride(username: string, verdict: CelebrityVerdict | null): CelebrityOverrides {
  const next = loadOverrides();
  if (verdict === null) delete next[username];
  else next[username] = verdict;
  try {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next));
  } catch {
    /* storage 불가 환경 무시 */
  }
  return next;
}
