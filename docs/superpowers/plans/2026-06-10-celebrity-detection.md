# 유명인·브랜드 구분 (인스타 맞팔 분석기) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위키데이터 P2003 명단(38만 계정)을 블룸필터로 내장해 결과 화면에서 유명인·브랜드 계정을 클라이언트 전용으로 판별 — 배지 + "제외" 토글 + 수동 보정(localStorage).

**Architecture:** 빌드 타임 스크립트가 QLever에서 CSV를 받아 블룸필터 바이너리(~480KB)를 `public/`에 생성·커밋. 클라이언트는 결과 화면에서 1회 lazy fetch 후 로컬 대조(수동 보정 > 블룸필터 > 휴리스틱). 사용자 목록은 절대 기기 밖으로 안 나감. 스펙: `docs/superpowers/specs/2026-06-10-celebrity-detection-design.md`.

**Tech Stack:** 순수 TS 블룸필터(FNV-1a 더블 해싱, 의존성 0), node:test + tsx, 기존 AccountList.tsx 확장.

**작업 위치:** `/root/bandsustain-dev/public_html/bandsustain` (dev 브랜치). 모든 git/pnpm/pm2 명령은 `sudo -u ec2-user`. Write/Edit 후 `sudo chown ec2-user:ec2-user <file>`. push 금지(마지막 컨트롤러 단계만), main 금지, PROD 금지.

---

## 파일 구조

```text
[생성] src/lib/playground/instagram/bloom.ts (+ bloom.test.ts)        # 순수 블룸필터 + 직렬화
[생성] scripts/build-celebrity-usernames.ts                            # QLever → celebs-v1.bin 생성 (수동 실행)
[생성] public/playground/instagram/celebs-v1.bin / celebs-v1.meta.json # 생성 산출물 (커밋)
[생성] src/lib/playground/instagram/celebrity.ts (+ celebrity.test.ts) # lazy load + classify + overrides
[수정] src/components/playground/instagram/AccountList.tsx             # 배지 + 제외 토글 + 수동 보정 UI
[수정] package.json                                                    # celebs:build 스크립트
```

---

### Task 1: bloom.ts — 순수 블룸필터 (TDD)

**Files:**
- Create: `src/lib/playground/instagram/bloom.ts`
- Test: `src/lib/playground/instagram/bloom.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { createBloom, bloomAdd, bloomHas, serializeBloom, deserializeBloom } from "./bloom";

test("멤버십: 추가한 항목은 전부 true", () => {
  const f = createBloom(1000, 0.01);
  const items = Array.from({ length: 1000 }, (_, i) => `user_${i}.name`);
  for (const s of items) bloomAdd(f, s);
  for (const s of items) assert.equal(bloomHas(f, s), true);
});

test("미포함 항목의 오탐율은 ~1% 수준 (< 3%)", () => {
  const f = createBloom(1000, 0.01);
  for (let i = 0; i < 1000; i++) bloomAdd(f, `member_${i}`);
  let fp = 0;
  for (let i = 0; i < 10000; i++) if (bloomHas(f, `absent_${i}`)) fp++;
  assert.ok(fp < 300, `false positives: ${fp}`);
});

test("직렬화/역직렬화 라운드트립", () => {
  const f = createBloom(500, 0.01);
  bloomAdd(f, "band_sustain");
  bloomAdd(f, "iu.official");
  const buf = serializeBloom(f);
  const g = deserializeBloom(buf);
  assert.equal(g.m, f.m);
  assert.equal(g.k, f.k);
  assert.equal(g.count, f.count);
  assert.equal(bloomHas(g, "band_sustain"), true);
  assert.equal(bloomHas(g, "iu.official"), true);
  assert.equal(bloomHas(g, "never_added_xyz"), false);
});

test("잘못된 매직/버전은 throw", () => {
  assert.throws(() => deserializeBloom(new Uint8Array([1, 2, 3, 4, 5])));
  const f = createBloom(10, 0.01);
  const buf = serializeBloom(f);
  buf[0] = 0x58; // 매직 훼손
  assert.throws(() => deserializeBloom(buf));
});

test("빈 필터는 전부 false", () => {
  const f = createBloom(100, 0.01);
  assert.equal(bloomHas(f, "anything"), false);
});
```

- [ ] **Step 2: 실패 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/bloom.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```typescript
// 직렬화 포맷: "BSBF"(4) + version u8 + k u8 + m u32LE + count u32LE + bits
const MAGIC = [0x42, 0x53, 0x42, 0x46]; // "BSBF"
const VERSION = 1;
const HEADER_BYTES = 14;

export type BloomFilter = { m: number; k: number; count: number; bits: Uint8Array };

function fnv1a(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function bitIndexes(f: BloomFilter, s: string): number[] {
  const h1 = fnv1a(s);
  let h2 = fnv1a(s, 0x9747b28c);
  if (h2 === 0) h2 = 0x27d4eb2f;
  const out: number[] = [];
  for (let i = 0; i < f.k; i++) out.push((h1 + i * h2) % f.m); // h1+6*h2 < 2^35 — double 안전
  return out;
}

export function createBloom(n: number, p = 0.01): BloomFilter {
  const m = Math.ceil((-n * Math.log(p)) / (Math.LN2 * Math.LN2));
  const k = Math.max(1, Math.round((m / n) * Math.LN2));
  return { m, k, count: 0, bits: new Uint8Array(Math.ceil(m / 8)) };
}

export function bloomAdd(f: BloomFilter, s: string): void {
  for (const idx of bitIndexes(f, s)) f.bits[idx >> 3] |= 1 << (idx & 7);
  f.count++;
}

export function bloomHas(f: BloomFilter, s: string): boolean {
  return bitIndexes(f, s).every((idx) => (f.bits[idx >> 3] & (1 << (idx & 7))) !== 0);
}

export function serializeBloom(f: BloomFilter): Uint8Array {
  const out = new Uint8Array(HEADER_BYTES + f.bits.length);
  out.set(MAGIC, 0);
  out[4] = VERSION;
  out[5] = f.k;
  new DataView(out.buffer).setUint32(6, f.m, true);
  new DataView(out.buffer).setUint32(10, f.count, true);
  out.set(f.bits, HEADER_BYTES);
  return out;
}

export function deserializeBloom(input: ArrayBuffer | Uint8Array): BloomFilter {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (buf.length < HEADER_BYTES || MAGIC.some((b, i) => buf[i] !== b)) {
    throw new Error("invalid bloom filter: bad magic");
  }
  if (buf[4] !== VERSION) throw new Error(`invalid bloom filter: version ${buf[4]}`);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const k = buf[5];
  const m = view.getUint32(6, true);
  const count = view.getUint32(10, true);
  const bits = buf.slice(HEADER_BYTES);
  if (bits.length !== Math.ceil(m / 8)) throw new Error("invalid bloom filter: size mismatch");
  return { m, k, count, bits };
}
```

- [ ] **Step 4: 통과 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/bloom.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
sudo -u ec2-user git add src/lib/playground/instagram/bloom*
sudo -u ec2-user git commit -m "feat(instagram-follow): dependency-free bloom filter with binary serialization"
```

---

### Task 2: 데이터셋 빌드 스크립트 + 산출물 생성

**Files:**
- Create: `scripts/build-celebrity-usernames.ts`
- Modify: `package.json` (scripts에 `"celebs:build": "tsx scripts/build-celebrity-usernames.ts"`)
- 산출물: `public/playground/instagram/celebs-v1.bin`, `public/playground/instagram/celebs-v1.meta.json`

- [ ] **Step 1: 스크립트 작성**

```typescript
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
```

- [ ] **Step 2: 실행 + 산출물 검증**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user pnpm celebs:build
ls -la public/playground/instagram/
cat public/playground/instagram/celebs-v1.meta.json
```

Expected: `OK: ~370000+ usernames → ~450000±50000 bytes`, meta의 distinctUsernames ≥ 350,000, bin 크기 400~520KB.

스팟체크 (생성된 bin을 다시 읽어 멤버십 확인):

```bash
sudo -u ec2-user pnpm exec tsx -e "
import { readFileSync } from 'node:fs';
import { deserializeBloom, bloomHas } from './src/lib/playground/instagram/bloom';
const f = deserializeBloom(readFileSync('public/playground/instagram/celebs-v1.bin'));
console.log('m', f.m, 'k', f.k, 'count', f.count);
// 메이저 셀럽 핸들 스팟체크 (위키데이터 등재 확실한 계정)
for (const u of ['cristiano', 'leomessi', 'taylorswift', 'bts.bighitofficial', 'dlwlrma']) {
  console.log(u, bloomHas(f, u));
}
console.log('절대 없을 무작위:', bloomHas(f, 'zzqq_definitely_not_9c2x'));
"
```

Expected: count = distinctUsernames, 셀럽 핸들 대부분 true (5개 중 4개 이상 — 일부는 위키데이터 표기가 다를 수 있음), 무작위 문자열 false. 만약 셀럽 핸들이 2개 이상 false면 정규화 버그 의심 — 원본 CSV에서 해당 행을 grep 해 확인 후 진행.

- [ ] **Step 3: 커밋**

```bash
sudo -u ec2-user git add scripts/build-celebrity-usernames.ts package.json public/playground/instagram/
sudo -u ec2-user git commit -m "feat(instagram-follow): wikidata celebrity username bloom dataset + build script"
```

---

### Task 3: celebrity.ts — 판별 모듈 (TDD)

**Files:**
- Create: `src/lib/playground/instagram/celebrity.ts`
- Test: `src/lib/playground/instagram/celebrity.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { classify } from "./celebrity";
import { createBloom, bloomAdd } from "./bloom";

function filterWith(...names: string[]) {
  const f = createBloom(100, 0.001);
  for (const n of names) bloomAdd(f, n);
  return f;
}

test("수동 보정이 최우선 (필터 매칭을 뒤집음)", () => {
  const f = filterWith("celeb_in_list");
  assert.equal(classify("celeb_in_list", f, { celeb_in_list: "person" }), "person");
  assert.equal(classify("plain_user", f, { plain_user: "celebrity" }), "celebrity");
});

test("블룸필터 매칭 → celebrity", () => {
  const f = filterWith("dlwlrma");
  assert.equal(classify("dlwlrma", f, {}), "celebrity");
  assert.equal(classify("my_friend_kim", f, {}), "person");
});

test("휴리스틱: 계정명에 official 포함 → celebrity (필터 미매칭이어도)", () => {
  const f = filterWith();
  assert.equal(classify("smtown_official", f, {}), "celebrity");
  assert.equal(classify("officialbts", f, {}), "celebrity");
  assert.equal(classify("unofficialfan", f, {}), "celebrity"); // 한계 — 허용 (추정 배지 + 수동 해제)
});

test("필터 null (로드 실패) 시 보정과 휴리스틱만 동작", () => {
  assert.equal(classify("dlwlrma", null, {}), "person");
  assert.equal(classify("dlwlrma", null, { dlwlrma: "celebrity" }), "celebrity");
  assert.equal(classify("x_official", null, {}), "celebrity");
});
```

- [ ] **Step 2: 실패 확인**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/celebrity.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```typescript
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
```

- [ ] **Step 4: 통과 확인 후 커밋**

Run: `sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/celebrity.test.ts` → PASS

```bash
sudo -u ec2-user git add src/lib/playground/instagram/celebrity*
sudo -u ec2-user git commit -m "feat(instagram-follow): celebrity classification (override > bloom > heuristic)"
```

---

### Task 4: AccountList UI — 배지 + 제외 토글 + 수동 보정

**Files:**
- Modify: `src/components/playground/instagram/AccountList.tsx`

- [ ] **Step 1: 통합 구현**

기존 파일을 읽고 다음을 추가한다 (기존 검색/정렬/더보기/Schwartzian 변환 로직은 유지):

(a) import 추가:

```typescript
import { useEffect, useMemo, useState } from "react";
import {
  classify,
  loadCelebrityFilter,
  loadOverrides,
  saveOverride,
  type CelebrityOverrides,
} from "@/lib/playground/instagram/celebrity";
import type { BloomFilter } from "@/lib/playground/instagram/bloom";
```

(b) 컴포넌트 상단 상태 (filter는 `undefined`=로딩중, `null`=로드실패→기능숨김):

```typescript
const [filter, setFilter] = useState<BloomFilter | null | undefined>(undefined);
const [overrides, setOverrides] = useState<CelebrityOverrides>({});
const [excludeCelebs, setExcludeCelebs] = useState(false);
useEffect(() => {
  let alive = true;
  loadCelebrityFilter().then((f) => {
    if (!alive) return;
    setFilter(f);
    setOverrides(loadOverrides());
  });
  return () => {
    alive = false;
  };
}, []);
const celebrityEnabled = filter !== null && filter !== undefined;
```

(c) 기존 `visible` useMemo의 decorated 항목에 verdict 추가 + 제외 필터 적용. decorated 생성부를 다음처럼 확장:

```typescript
const decorated = base.map((a) => {
  const d = primaryDate(a, tab);
  return {
    a,
    dateKey: d,
    daysKey: d ? followDayCount(d) : null,
    verdict: celebrityEnabled ? classify(a.username, filter ?? null, overrides) : ("person" as const),
  };
});
```

useMemo 의존성 배열에 `filter`, `overrides`, `celebrityEnabled` 추가. 반환 직전에:

```typescript
const celebCount = decorated.filter((d) => d.verdict === "celebrity").length;
const shown = excludeCelebs ? decorated.filter((d) => d.verdict !== "celebrity") : decorated;
```

useMemo가 `{ rows: shown, celebCount }` 형태를 반환하도록 바꾸고 (excludeCelebs도 의존성에 추가), 렌더부의 `visible` 참조를 `rows`로 교체한다. 카드 렌더는 `rows.slice(0, limit).map(({ a, verdict }) => ...)` 형태로 verdict에 접근.

(d) 툴바(검색/정렬 줄 아래)에 토글 + 고지 — `celebrityEnabled`일 때만:

```tsx
{celebrityEnabled && (
  <div className="space-y-1">
    <label className="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={excludeCelebs}
        onChange={(e) => setExcludeCelebs(e.target.checked)}
      />
      유명인·브랜드 제외 ({celebCount.toLocaleString()})
    </label>
    <p className="text-xs text-[var(--color-text-muted)]">
      위키백과 등재 기준 자동 추정이라 누락·오판이 있을 수 있어요. 배지를 눌러 직접 고칠 수 있어요.
    </p>
  </div>
)}
```

(e) 계정 카드 username 줄 아래에 배지/수동 보정 버튼 — `celebrityEnabled`일 때만:

```tsx
{celebrityEnabled &&
  (verdict === "celebrity" ? (
    <button
      type="button"
      onClick={() => setOverrides(saveOverride(a.username, "person"))}
      className="text-xs text-[var(--color-accent)]"
      title="누르면 일반인으로 표시"
    >
      ⭐ 유명인·브랜드 추정 ✕
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOverrides(saveOverride(a.username, "celebrity"))}
      className="text-xs text-[var(--color-text-muted)] underline underline-offset-2"
    >
      유명인으로 표시
    </button>
  ))}
```

주의: 수동 보정으로 자동 판정과 같은 값이 되는 경우(예: 자동 person인 계정을 person으로 해제)는 `saveOverride(username, null)`로 키를 지우는 게 이상적이지만, 단순화를 위해 "celebrity 카드의 ✕ → person 저장 / person 카드의 표시 → celebrity 저장" 두 동작만 둔다 (토글 반복 시에도 동작 일관).

- [ ] **Step 2: lint + 빌드 + 재기동 + 스모크**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user pnpm lint   # 신규 에러 0 (set-state-in-effect 룰 주의 — 위 코드는 promise then 콜백이라 안 걸림; 걸리면 IntroScreen.tsx의 기존 disable 패턴 사용)
sudo -u ec2-user pnpm build
sudo -u ec2-user pm2 restart bandsustain-dev
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3101/playground/instagram-follow"   # 200
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" "http://127.0.0.1:3101/playground/instagram/celebs-v1.bin"   # 200 + ~450KB
```

- [ ] **Step 3: 커밋**

```bash
sudo -u ec2-user git add src/components/playground/instagram/AccountList.tsx
sudo -u ec2-user git commit -m "feat(instagram-follow): celebrity badge, exclude toggle, manual override"
```

---

### Task 5: 최종 검증 + 실측 스모크 (push는 컨트롤러가)

- [ ] **Step 1: 전체 테스트**

```bash
cd /root/bandsustain-dev/public_html/bandsustain
sudo -u ec2-user pnpm exec tsx --test src/lib/playground/instagram/*.test.ts   # 기존 42 + 신규 9 = 51 PASS
```

- [ ] **Step 2: 실측 ZIP 매칭 스모크** (following 774건 분류 — 상식 범위 확인)

```bash
sudo -u ec2-user pnpm exec tsx -e "
import { readFileSync } from 'node:fs';
import { analyzeZip } from './src/lib/playground/instagram/analyzeZip';
import { deserializeBloom } from './src/lib/playground/instagram/bloom';
import { classify } from './src/lib/playground/instagram/celebrity';
const f = deserializeBloom(readFileSync('public/playground/instagram/celebs-v1.bin'));
const buf = readFileSync('/var/www/html/_______site_BANDSUSTAIN/instagram-_mongsil_kim-2026-06-08-qNJMxQEM.zip');
const r = await analyzeZip(new File([buf], 'x.zip'));
const verdicts = r.relations.following.map(a => ({ u: a.username, v: classify(a.username, f, {}) }));
const celebs = verdicts.filter(x => x.v === 'celebrity');
console.log('following', verdicts.length, '중 celebrity', celebs.length);
console.log('샘플 20:', celebs.slice(0, 20).map(x => x.u).join(', '));
const nfmb = r.relations.notFollowingMeBack.map(a => classify(a.username, f, {}));
console.log('notFollowingMeBack', nfmb.length, '중 celebrity', nfmb.filter(v => v === 'celebrity').length);
"
```

Expected: celebrity 수가 0도 아니고 전체의 절반 이상도 아닌 상식적 범위(대략 20~250). 샘플 20개를 눈으로 봐서 명백한 일반인 핸들 위주라면(=오탐 과다) BLOCKED 보고. 음악 팬 계정 특성상 밴드·뮤지션 계정이 다수 잡혀야 정상.

- [ ] **Step 3: 보고** — 매칭 수치·샘플 목록 포함해 컨트롤러에 보고. push와 사용자 확인 요청은 컨트롤러 담당.

---

## Self-Review

- **스펙 커버리지**: §1 데이터셋→Task 2, §2 판별 모듈(bloom/celebrity/lazy/실패 시 숨김)→Task 1·3·4(b), §3 UI(배지/토글/수동보정/고지/미로드 숨김)→Task 4, §4 테스트(bloom 라운드트립·멤버십·헤더, classify 우선순위·휴리스틱, 실측 스모크)→Task 1·3·5. 갭 없음.
- **타입 일관성**: `BloomFilter {m,k,count,bits}` ↔ serialize/deserialize ↔ celebrity.ts import 일치. `classify(username, filter: BloomFilter|null, overrides)` 시그니처가 테스트·UI 호출부와 일치. `saveOverride` 반환값을 setOverrides에 바로 전달하는 계약 일치.
- **플레이스홀더 없음**: 전 단계 실제 코드/명령/expected 포함.
