// 밴드 이름 생성기 — 생성 알고리즘 (순수 함수, 외부 AI 호출 없음).
//
// 흐름: 언어별 패턴 풀 → 씬/분위기/이상함 가중치로 패턴 선택 → 슬롯 채우기 →
//       점수화 → 차단 조합/밴드명 제거 → 다수 후보 중 서로 안 겹치는 3개 선별.

import {
  moodCategoryBoosts,
  moodLabels,
  sceneCategoryBoosts,
  sceneLabels,
} from "./data";
import type {
  BandNameDataset,
  BandNameInput,
  GeneratedBandName,
  LanguageStyle,
  Pattern,
  SlotLanguage,
  WordCategory,
} from "./types";

export const CANDIDATE_COUNT = 180;
export const RESULT_COUNT = 3;

export type Rng = () => number;

// 결정론적 테스트용 시드 PRNG (mulberry32). 기본은 Math.random.
export function makeSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 조합 판정 헬퍼
// ---------------------------------------------------------------------------
export type PairSets = { preferred: Set<string>; blocked: Set<string> };

// 데이터셋의 페어 배열을 빠른 조회용 Set 으로. (생성 1회당 1번 빌드)
export function buildPairSets(dataset: BandNameDataset): PairSets {
  return {
    preferred: new Set(dataset.preferredPairs.map(([a, b]) => `${a} ${b}`)),
    // 차단 조합은 의미 중복이라 순서 무관.
    blocked: new Set(dataset.blockedPairs.flatMap(([a, b]) => [`${a} ${b}`, `${b} ${a}`])),
  };
}

export function isPreferredPair(sets: PairSets, a: string, b: string): boolean {
  return sets.preferred.has(`${a} ${b}`);
}

export function isBlockedPair(sets: PairSets, a: string, b: string): boolean {
  return sets.blocked.has(`${a} ${b}`);
}

export function isBlockedExactName(blocked: Set<string>, name: string): boolean {
  return blocked.has(name) || blocked.has(name.toUpperCase());
}

// odd/food 기반이거나 machine+emotion 조합인 패턴을 "웃긴 패턴"으로 본다.
// (스펙의 ko_odd_youth/ko_odd_suffix/ko_food_suffix/ko_machine_emotion 및
//  영어 동치 패턴을 일반화.)
export function isFunnyPattern(pattern: Pattern): boolean {
  const s = pattern.slots;
  return (
    s.includes("odd") ||
    s.includes("food") ||
    (s.includes("machine") && s.includes("emotion"))
  );
}

// ---------------------------------------------------------------------------
// 패턴 풀 / 슬롯 언어 / 단어 풀
// ---------------------------------------------------------------------------
function patternPool(dataset: BandNameDataset, language: LanguageStyle): Pattern[] {
  if (language === "english") return dataset.englishPatterns;
  if (language === "korean") return dataset.koreanPatterns;
  // mixed: 한국어 2슬롯 패턴을 차용하되 첫 슬롯을 영어 단어로 채운다.
  return dataset.koreanPatterns.filter(
    (p) => p.slots.length === 2 && (dataset.englishWords[p.slots[0]]?.length ?? 0) > 0,
  );
}

function slotLanguages(language: LanguageStyle, slotCount: number): SlotLanguage[] {
  if (language === "english") return Array(slotCount).fill("english");
  if (language === "korean") return Array(slotCount).fill("korean");
  // mixed: 첫 단어는 영어, 나머지는 한국어.
  return Array.from({ length: slotCount }, (_, i) => (i === 0 ? "english" : "korean"));
}

function separatorFor(language: LanguageStyle, pattern: Pattern): string {
  // 스크립트가 섞이는 mixed 는 가독성을 위해 공백으로 잇는다.
  return language === "mixed" ? " " : pattern.separator;
}

function wordPool(dataset: BandNameDataset, category: WordCategory, lang: SlotLanguage): string[] {
  return (lang === "english" ? dataset.englishWords[category] : dataset.koreanWords[category]) ?? [];
}

// ---------------------------------------------------------------------------
// 가중치 랜덤
// ---------------------------------------------------------------------------
function pickWeighted<T>(items: T[], weights: number[], rng: Rng): T {
  const total = weights.reduce((sum, w) => sum + (w > 0 ? w : 0), 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    const w = weights[i] > 0 ? weights[i] : 0;
    if (roll < w) return items[i];
    roll -= w;
  }
  return items[items.length - 1];
}

function pickOne<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

// 씬/분위기 카테고리 보정 + 씬·분위기 직접 매칭 + 이상함 범위를 반영한 패턴 가중치.
export function effectivePatternWeight(pattern: Pattern, input: BandNameInput): number {
  // 메탈 패턴은 메탈 씬 전용. base weight 가 높고 mood 커버리지가 넓어서,
  // 게이팅이 없으면 다른 씬에서도 weighted 선택을 압도해 점령한다(96%+ 누수).
  // 자기 scenes 에 선택된 씬이 없으면 weight 0 으로 후보 생성에서 제외한다.
  // (비-메탈 패턴끼리의 약한 cross-leak 은 의도된 다양성이라 그대로 둔다.)
  if (pattern.scenes.includes("metal") && !pattern.scenes.includes(input.scene)) {
    return 0;
  }

  let w = pattern.weight;

  const sceneBoost = sceneCategoryBoosts[input.scene];
  const moodBoost = moodCategoryBoosts[input.mood];
  let catFactor = 1;
  for (const slot of pattern.slots) {
    catFactor *= (sceneBoost[slot] ?? 1) * (moodBoost[slot] ?? 1);
  }
  // 슬롯 수에 따른 폭주를 막기 위해 기하평균.
  catFactor = Math.pow(catFactor, 1 / pattern.slots.length);
  w *= catFactor;

  if (pattern.scenes.includes(input.scene)) w *= 2.2;
  if (pattern.moods.includes(input.mood)) w *= 1.8;

  // 이상함 범위를 벗어난 패턴은 완전 제외하지 않고 꼬리만 남긴다 (다양성 보험).
  if (input.weirdness < pattern.minWeirdness || input.weirdness > pattern.maxWeirdness) {
    w *= 0.04;
  }

  return w;
}

// ---------------------------------------------------------------------------
// 점수화
// ---------------------------------------------------------------------------

// 메탈 씬에서 "웃긴" 결을 내는 패턴 (생활가전·음식·생활용품 + 메탈 단어).
// 이상함이 낮으면 강하게 감점, 높거나 funny 면 보너스.
const FUNNY_METAL_PATTERNS = new Set([
  "ko_machine_ritual_metal", "ko_odd_doom_metal", "ko_food_ritual_metal",
  "en_machine_ritual_metal", "en_odd_doom_metal", "en_food_ritual_metal",
]);

// 메탈 씬 전용 점수 보정. 진중한 메탈 패턴은 가산, 비-메탈 패턴은 크게 감점해
// 펑크/시티팝 등 다른 씬의 결이 새지 않게 하고, 짧고 묵직한 이름을 선호한다.
function applyMetalSceneScoreAdjustments(
  score: number,
  words: string[],
  input: BandNameInput,
  pattern: Pattern,
): number {
  const isMetalPattern = pattern.scenes.includes("metal");
  // 메탈 씬인데 비-메탈 패턴 → 강한 감점 (다른 씬 결 누출 차단).
  if (!isMetalPattern) return score - 80;

  const isFunnyMetal = FUNNY_METAL_PATTERNS.has(pattern.id);
  if (!isFunnyMetal) score += 30; // 진중한 메탈 패턴 보너스

  if (input.weirdness <= 2 && isFunnyMetal) score -= 120;
  if ((input.weirdness >= 4 || input.mood === "funny") && isFunnyMetal) score += 45;

  if (input.language === "korean") {
    const len = words.join("").length;
    if (len >= 3 && len <= 7) score += 25;
    else if (len >= 8 && len <= 9) score += input.weirdness >= 4 ? 10 : -20;
    if (len >= 10) score -= 100;
  }

  if (input.language === "english") {
    // 슬롯 수가 아니라 실제 토큰 수로 본다 ("BARBED WIRE" 같은 2어절 단어 때문).
    const fullName = words.join(" ");
    const tokenCount = fullName.split(" ").length;
    if (tokenCount === 2) score += 20;
    if (tokenCount >= 4 || fullName.length > 24) score -= 80;
  }

  return score;
}

export function scoreGeneratedName(
  name: string,
  words: string[],
  input: BandNameInput,
  pattern: Pattern,
  sets: PairSets,
): number {
  // 점수는 "만들어진 이름의 품질"만 판단한다(길이·선호조합·씬매칭·웃김 적합도).
  // 패턴 선호도(weight)는 effectivePatternWeight 의 선택 빈도에서 이미 반영되므로,
  // 점수에까지 base 로 또 넣으면 고-weight 패턴이 이중으로 유리해져 한 씬이 소수
  // 패턴에 쏠린다(이전: citypop/emo/campus top3 97~99%). base 를 빼 다양성을 회복.
  let score = 0;

  // 길이 점수
  if (input.language === "korean") {
    if (name.length >= 3 && name.length <= 7) score += 30;
    if (name.length === 2) score += 10;
    if (name.length >= 8) score -= 20;
    if (name.length >= 10) score -= 40;
  }

  if (input.language === "english") {
    const wordCount = name.split(" ").length;
    if (wordCount >= 2 && wordCount <= 3) score += 25;
    if (name.length > 24) score -= 25;
  }

  if (input.language === "mixed") {
    if (name.length >= 4 && name.length <= 15) score += 20;
    if (name.length > 18) score -= 25;
  }

  // 선호 조합 보너스 (슬롯 순서 그대로)
  for (let i = 0; i < words.length - 1; i++) {
    if (isPreferredPair(sets, words[i], words[i + 1])) score += 35;
  }

  // 차단 조합 감점
  for (let i = 0; i < words.length - 1; i++) {
    if (isBlockedPair(sets, words[i], words[i + 1])) score -= 100;
  }

  // 같은 단어 반복 방지
  if (new Set(words).size !== words.length) score -= 100;

  // 이상함이 낮은데 웃긴 패턴이면 감점
  if (input.weirdness <= 2 && isFunnyPattern(pattern)) score -= 60;

  // funny 이거나 이상함이 높으면 웃긴 패턴 보너스
  if ((input.mood === "funny" || input.weirdness >= 4) && isFunnyPattern(pattern)) {
    score += 30;
  }

  // 씬 정체성 보정 (메탈 외 6씬). base 항 pattern.weight*10 이 씬과 무관하게
  // 고-weight 패턴(jrock 13~14)을 top-3 에 올려 모든 씬을 점령하던 문제를 바로잡는다.
  // 선택 씬을 패턴이 명시하면 가산, 아니면 큰 감산 → 결과가 그 씬 패턴 위주가 된다.
  // (씬에 맞는 패턴이 하나도 없으면 모두 동일 감산이라 자연히 off-scene 으로 폴백.)
  // metal 씬은 아래 전용 블록이 처리.
  if (input.scene !== "metal") {
    if (pattern.scenes.includes(input.scene)) score += 40;
    else score -= 80;
  }

  // 메탈 씬 전용 보정
  if (input.scene === "metal") {
    score = applyMetalSceneScoreAdjustments(score, words, input, pattern);
  }

  return score;
}

// ---------------------------------------------------------------------------
// 단일 후보 생성
// ---------------------------------------------------------------------------
function generateCandidate(
  dataset: BandNameDataset,
  input: BandNameInput,
  pool: Pattern[],
  sets: PairSets,
  rng: Rng,
): GeneratedBandName | null {
  if (pool.length === 0) return null;

  const pattern = pickWeighted(pool, pool.map((p) => effectivePatternWeight(p, input)), rng);

  const langs = slotLanguages(input.language, pattern.slots.length);
  const words: string[] = [];
  for (let i = 0; i < pattern.slots.length; i++) {
    const candidates = wordPool(dataset, pattern.slots[i], langs[i]);
    if (candidates.length === 0) return null;
    words.push(pickOne(candidates, rng));
  }

  if (new Set(words).size !== words.length) return null;
  for (let i = 0; i < words.length - 1; i++) {
    if (isBlockedPair(sets, words[i], words[i + 1])) return null;
  }

  const name = words.join(separatorFor(input.language, pattern));
  if (isBlockedExactName(dataset.blockedExactNames, name)) return null;

  return {
    name,
    scene: input.scene,
    mood: input.mood,
    patternId: pattern.id,
    score: scoreGeneratedName(name, words, input, pattern, sets),
    tags: [sceneLabels[input.scene], moodLabels[input.mood]],
    usedWords: words,
  };
}

// ---------------------------------------------------------------------------
// 다양성 선별 (스펙 15번)
// ---------------------------------------------------------------------------
export function selectDiverseResults(
  candidates: GeneratedBandName[],
  resultCount: number = RESULT_COUNT,
): GeneratedBandName[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected: GeneratedBandName[] = [];
  const usedFirstWords = new Set<string>();
  const usedAllWords = new Set<string>();
  const usedPatterns = new Set<string>();

  for (const candidate of sorted) {
    if (selected.some((item) => item.name === candidate.name)) continue;

    const firstWord = candidate.usedWords[0];
    if (usedFirstWords.has(firstWord)) continue;

    const overlaps = candidate.usedWords.some((word) => usedAllWords.has(word));
    if (overlaps && selected.length < resultCount - 1) continue;

    const samePattern = usedPatterns.has(candidate.patternId);
    if (samePattern && selected.length < resultCount - 1) continue;

    selected.push(candidate);
    usedFirstWords.add(firstWord);
    candidate.usedWords.forEach((word) => usedAllWords.add(word));
    usedPatterns.add(candidate.patternId);

    if (selected.length === resultCount) break;
  }

  // 조건이 너무 엄격해 다 못 채웠으면, 중복 이름만 빼고 점수순으로 채운다.
  if (selected.length < resultCount) {
    for (const candidate of sorted) {
      if (selected.some((item) => item.name === candidate.name)) continue;
      selected.push(candidate);
      if (selected.length === resultCount) break;
    }
  }

  return selected;
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------
export function generateBandNames(
  input: BandNameInput,
  dataset: BandNameDataset,
  rng: Rng = Math.random,
): GeneratedBandName[] {
  const pool = patternPool(dataset, input.language);
  if (pool.length === 0) return [];

  const sets = buildPairSets(dataset);
  const candidates: GeneratedBandName[] = [];
  const maxAttempts = CANDIDATE_COUNT * 5;
  for (let i = 0; i < maxAttempts && candidates.length < CANDIDATE_COUNT; i++) {
    const candidate = generateCandidate(dataset, input, pool, sets, rng);
    if (candidate) candidates.push(candidate);
  }

  return selectDiverseResults(candidates, RESULT_COUNT);
}
