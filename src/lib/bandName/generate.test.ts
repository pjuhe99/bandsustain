import assert from "node:assert/strict";
import test from "node:test";

import { blockedExactNames, defaultDataset, koreanPatterns, englishPatterns } from "./data";
import {
  buildPairSets,
  generateBandNames,
  isBlockedPair,
  isFunnyPattern,
  isPreferredPair,
  makeSeededRng,
  RESULT_COUNT,
  scoreGeneratedName,
  selectDiverseResults,
} from "./generate";
import type { BandNameInput, GeneratedBandName } from "./types";

const SAMPLE_INPUTS: BandNameInput[] = [
  { scene: "jrock", mood: "fresh", language: "korean", weirdness: 2 },
  { scene: "hongdae", mood: "funny", language: "korean", weirdness: 5 },
  { scene: "citypop", mood: "romantic", language: "mixed", weirdness: 2 },
  { scene: "punk", mood: "rough", language: "english", weirdness: 4 },
  { scene: "emo", mood: "dreamy", language: "korean", weirdness: 3 },
];

test("returns exactly 3 results for every language", () => {
  for (const input of SAMPLE_INPUTS) {
    const results = generateBandNames(input, defaultDataset, makeSeededRng(42));
    assert.equal(results.length, RESULT_COUNT, `language=${input.language}`);
  }
});

test("results within a set never repeat the same name", () => {
  for (let seed = 0; seed < 60; seed++) {
    for (const input of SAMPLE_INPUTS) {
      const names = generateBandNames(input, defaultDataset, makeSeededRng(seed)).map((r) => r.name);
      assert.equal(new Set(names).size, names.length, `dup in ${input.language} seed ${seed}`);
    }
  }
});

test("well-populated inputs yield 3 distinct first words", () => {
  const input: BandNameInput = { scene: "jrock", mood: "fresh", language: "korean", weirdness: 2 };
  for (let seed = 0; seed < 40; seed++) {
    const results = generateBandNames(input, defaultDataset, makeSeededRng(seed));
    const firstWords = results.map((r) => r.usedWords[0]);
    assert.equal(new Set(firstWords).size, firstWords.length, `shared first word at seed ${seed}`);
  }
});

test("never emits an exact real band name", () => {
  const inputs: BandNameInput[] = SAMPLE_INPUTS.concat([
    { scene: "emo", mood: "wistful", language: "english", weirdness: 3 },
    { scene: "campus", mood: "fresh", language: "mixed", weirdness: 4 },
  ]);
  for (let seed = 0; seed < 150; seed++) {
    for (const input of inputs) {
      for (const r of generateBandNames(input, defaultDataset, makeSeededRng(seed))) {
        assert.ok(
          !blockedExactNames.has(r.name) && !blockedExactNames.has(r.name.toUpperCase()),
          `blocked name "${r.name}" leaked (${input.language} seed ${seed})`,
        );
      }
    }
  }
});

test("korean results are compact (2+ words, not absurdly long)", () => {
  const input: BandNameInput = { scene: "jrock", mood: "fresh", language: "korean", weirdness: 2 };
  for (let seed = 0; seed < 40; seed++) {
    for (const r of generateBandNames(input, defaultDataset, makeSeededRng(seed))) {
      assert.ok(r.usedWords.length >= 2, `too few words: ${r.name}`);
      assert.ok(r.name.length <= 9, `too long: ${r.name}`);
    }
  }
});

test("english results are 1-3 words", () => {
  const input: BandNameInput = { scene: "punk", mood: "rough", language: "english", weirdness: 4 };
  for (let seed = 0; seed < 40; seed++) {
    for (const r of generateBandNames(input, defaultDataset, makeSeededRng(seed))) {
      const wc = r.name.split(" ").length;
      assert.ok(wc >= 1 && wc <= 4, `unexpected word count for "${r.name}"`);
    }
  }
});

test("mixed results pair an ASCII-uppercase word with a Korean word", () => {
  const input: BandNameInput = { scene: "citypop", mood: "romantic", language: "mixed", weirdness: 2 };
  for (let seed = 0; seed < 40; seed++) {
    for (const r of generateBandNames(input, defaultDataset, makeSeededRng(seed))) {
      const parts = r.name.split(" ");
      assert.ok(/[A-Z]/.test(parts[0]), `mixed first part not english: ${r.name}`);
      assert.ok(/[가-힣]/.test(parts[parts.length - 1]), `mixed last part not korean: ${r.name}`);
    }
  }
});

test("funny patterns appear far more at weirdness 5 than weirdness 1", () => {
  let funnyHigh = 0;
  let funnyLow = 0;
  for (let seed = 0; seed < 80; seed++) {
    const high = generateBandNames(
      { scene: "hongdae", mood: "funny", language: "korean", weirdness: 5 },
      defaultDataset, makeSeededRng(seed),
    );
    const low = generateBandNames(
      { scene: "hongdae", mood: "fresh", language: "korean", weirdness: 1 },
      defaultDataset, makeSeededRng(seed),
    );
    funnyHigh += high.filter((r) => isFunnyPattern(patternById(r.patternId))).length;
    funnyLow += low.filter((r) => isFunnyPattern(patternById(r.patternId))).length;
  }
  assert.ok(funnyHigh > funnyLow, `expected more funny patterns at w5 (${funnyHigh}) than w1 (${funnyLow})`);
});

test("pair + funny-pattern helpers behave", () => {
  const sets = buildPairSets(defaultDataset);
  assert.equal(isPreferredPair(sets, "새벽", "옥상"), true);
  assert.equal(isPreferredPair(sets, "옥상", "새벽"), false); // 순서 지킴
  assert.equal(isBlockedPair(sets, "새벽", "아침"), true);
  assert.equal(isBlockedPair(sets, "아침", "새벽"), true); // 순서 무관
  assert.equal(isFunnyPattern(patternById("ko_odd_suffix")), true);
  assert.equal(isFunnyPattern(patternById("ko_machine_emotion")), true);
  assert.equal(isFunnyPattern(patternById("ko_time_place")), false);
});

test("scoring rewards preferred pairs and punishes duplicates", () => {
  const input: BandNameInput = { scene: "jrock", mood: "fresh", language: "korean", weirdness: 2 };
  const pattern = patternById("ko_time_place");
  const sets = buildPairSets(defaultDataset);
  const preferred = scoreGeneratedName("새벽옥상", ["새벽", "옥상"], input, pattern, sets);
  const neutral = scoreGeneratedName("저녁복도", ["저녁", "복도"], input, pattern, sets);
  assert.ok(preferred > neutral, "preferred pair should score higher");

  const dup = scoreGeneratedName("옥상옥상", ["옥상", "옥상"], input, pattern, sets);
  assert.ok(dup < neutral, "duplicate words should be punished");
});

test("selectDiverseResults dedupes and limits shared first words", () => {
  const mk = (name: string, words: string[], patternId: string, score: number): GeneratedBandName => ({
    name,
    words,
    patternId,
    score,
    scene: "jrock",
    mood: "fresh",
    tags: [],
    usedWords: words,
  } as unknown as GeneratedBandName);

  const candidates = [
    mk("새벽옥상", ["새벽", "옥상"], "ko_time_place", 200),
    mk("새벽정류장", ["새벽", "정류장"], "ko_time_place", 190),
    mk("새벽비상구", ["새벽", "비상구"], "ko_time_place", 180),
    mk("여름카세트", ["여름", "카세트"], "ko_season_analog", 170),
    mk("노이즈클럽", ["노이즈", "클럽"], "ko_room_suffix", 160),
  ];
  const picked = selectDiverseResults(candidates, 3);
  assert.equal(picked.length, 3);
  const firstWords = picked.map((p) => p.usedWords[0]);
  assert.equal(new Set(firstWords).size, 3, "first words should be distinct");
});

// --- 메탈 / 헤비록 씬 ---
const METAL_PATTERN_IDS = new Set(
  [...koreanPatterns, ...englishPatterns].filter((p) => p.scenes.includes("metal")).map((p) => p.id),
);
const FUNNY_METAL_IDS = new Set([
  "ko_machine_ritual_metal", "ko_odd_doom_metal", "ko_food_ritual_metal",
  "en_machine_ritual_metal", "en_odd_doom_metal", "en_food_ritual_metal",
]);

test("metal scene only yields metal patterns (no other-scene leakage)", () => {
  for (const lang of ["korean", "english", "mixed"] as const) {
    for (let seed = 0; seed < 50; seed++) {
      for (const r of generateBandNames(
        { scene: "metal", mood: "rough", language: lang, weirdness: 3 },
        defaultDataset, makeSeededRng(seed),
      )) {
        assert.ok(METAL_PATTERN_IDS.has(r.patternId), `non-metal pattern ${r.patternId} (${lang}) → ${r.name}`);
      }
    }
  }
});

test("metal weirdness 1-2 stays serious (no funny food/odd/machine patterns)", () => {
  for (const w of [1, 2] as const) {
    for (let seed = 0; seed < 50; seed++) {
      for (const r of generateBandNames(
        { scene: "metal", mood: "rough", language: "korean", weirdness: w },
        defaultDataset, makeSeededRng(seed),
      )) {
        assert.ok(!FUNNY_METAL_IDS.has(r.patternId), `funny metal pattern leaked at w${w}: ${r.patternId} (${r.name})`);
      }
    }
  }
});

test("metal funny patterns DO appear at weirdness 5 / funny mood", () => {
  let funnyHits = 0;
  for (let seed = 0; seed < 60; seed++) {
    for (const r of generateBandNames(
      { scene: "metal", mood: "funny", language: "korean", weirdness: 5 },
      defaultDataset, makeSeededRng(seed),
    )) {
      if (FUNNY_METAL_IDS.has(r.patternId)) funnyHits++;
    }
  }
  assert.ok(funnyHits > 0, "expected some funny metal patterns at weirdness 5 / funny");
});

test("korean metal names stay compact and never emit a real band name", () => {
  for (const w of [1, 3, 5] as const) {
    for (let seed = 0; seed < 60; seed++) {
      for (const r of generateBandNames(
        { scene: "metal", mood: w === 5 ? "funny" : "rough", language: "korean", weirdness: w },
        defaultDataset, makeSeededRng(seed),
      )) {
        assert.ok(r.name.length <= 10, `korean metal name too long: ${r.name} (w${w})`);
        assert.ok(
          !blockedExactNames.has(r.name) && !blockedExactNames.has(r.name.toUpperCase()),
          `blocked metal band name leaked: ${r.name}`,
        );
      }
    }
  }
});

test("english metal names are 2-3 words and never a real band name", () => {
  for (let seed = 0; seed < 60; seed++) {
    for (const r of generateBandNames(
      { scene: "metal", mood: "rough", language: "english", weirdness: 2 },
      defaultDataset, makeSeededRng(seed),
    )) {
      const wc = r.name.split(" ").length;
      assert.ok(wc >= 2 && wc <= 3, `unexpected word count for metal "${r.name}"`);
      assert.ok(!blockedExactNames.has(r.name.toUpperCase()), `blocked metal band name: ${r.name}`);
    }
  }
});

function patternById(id: string) {
  const p = [...koreanPatterns, ...englishPatterns].find((x) => x.id === id);
  if (!p) throw new Error(`unknown pattern ${id}`);
  return p;
}
