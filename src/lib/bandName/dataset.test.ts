import assert from "node:assert/strict";
import test from "node:test";
import { rowsToDataset } from "./dataset";
import { generateBandNames, makeSeededRng } from "./generate";
import type { BandNameInput } from "./types";

test("rowsToDataset groups words by language/category and parses patterns", () => {
  const ds = rowsToDataset(
    [
      { language: "korean", category: "time", word: "새벽" },
      { language: "korean", category: "place", word: "옥상" },
      { language: "english", category: "time", word: "MIDNIGHT" },
    ] as never,
    [
      {
        pattern_key: "ko_time_place", language: "korean",
        slots: ["time", "place"], scenes: ["jrock"], moods: ["fresh"],
        separator: "", min_weirdness: 1, max_weirdness: 3, weight: 14,
      },
    ] as never,
    [
      { kind: "preferred", word_a: "새벽", word_b: "옥상" },
      { kind: "blocked", word_a: "밤", word_b: "한밤" },
    ] as never,
    [{ name: "혁오" }] as never,
  );

  assert.deepEqual(ds.koreanWords.time, ["새벽"]);
  assert.deepEqual(ds.koreanWords.place, ["옥상"]);
  assert.deepEqual(ds.englishWords.time, ["MIDNIGHT"]);
  assert.equal(ds.koreanPatterns.length, 1);
  assert.equal(ds.koreanPatterns[0].id, "ko_time_place");
  assert.deepEqual(ds.koreanPatterns[0].slots, ["time", "place"]);
  assert.deepEqual(ds.preferredPairs, [["새벽", "옥상"]]);
  assert.deepEqual(ds.blockedPairs, [["밤", "한밤"]]);
  assert.ok(ds.blockedExactNames.has("혁오"));
});

test("rowsToDataset parses JSON columns whether string or object", () => {
  const ds = rowsToDataset(
    [{ language: "korean", category: "time", word: "새벽" },
     { language: "korean", category: "place", word: "옥상" }] as never,
    [{
      pattern_key: "ko_time_place", language: "korean",
      slots: '["time","place"]', scenes: '["jrock"]', moods: '["fresh"]',
      separator: "", min_weirdness: 1, max_weirdness: 3, weight: 14,
    }] as never,
    [] as never, [] as never,
  );
  assert.deepEqual(ds.koreanPatterns[0].slots, ["time", "place"]);
  // 생성기가 이 데이터셋으로 동작하는지 (통합)
  const input: BandNameInput = { scene: "jrock", mood: "fresh", language: "korean", weirdness: 2 };
  const out = generateBandNames(input, ds, makeSeededRng(1));
  assert.ok(out.length >= 1 && out[0].name.length >= 2);
});
