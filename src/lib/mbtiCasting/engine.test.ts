// src/lib/mbtiCasting/engine.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { recommendBandCasting, type BandCastingInput } from "./engine";
import {
  MBTI_PROFILES, GENRES, STAGE_PREFERENCES, SOUND_PREFERENCES,
  EXPERIENCES, BUDGETS, POSITION_PRIORITY,
} from "./data";
import type { MbtiId, GenreId } from "./types";

const base: BandCastingInput = {
  mbti: "INFP", genre: "indieRock", stagePreference: "foundation",
  soundPreference: "lowEnd", experience: "starter", budget: "under600",
};

test("all 16 MBTI produce a valid result", () => {
  for (const mbti of Object.keys(MBTI_PROFILES) as MbtiId[]) {
    const r = recommendBandCasting({ ...base, mbti });
    assert.ok(POSITION_PRIORITY.includes(r.primaryPosition));
    assert.notEqual(r.primaryPosition, r.secondaryPosition);
    assert.equal(r.songs.length, 3);
    assert.equal(r.gear.items.length, 3);
    assert.ok(r.moodTags.length > 0 && r.moodTags.length <= 3);
  }
});

test("all 7 genres produce a valid result", () => {
  for (const genre of Object.keys(GENRES) as GenreId[]) {
    const r = recommendBandCasting({ ...base, genre });
    assert.equal(r.songs.length, 3);
    assert.equal(r.gear.items.length, 3);
  }
});

test("deterministic: same input yields same output", () => {
  const a = recommendBandCasting(base);
  const b = recommendBandCasting(base);
  assert.equal(a.primaryPosition, b.primaryPosition);
  assert.deepEqual(a.songs.map((s) => s.id), b.songs.map((s) => s.id));
  assert.deepEqual(a.gear.items, b.gear.items);
});

test("every position can be primary for some input combination", () => {
  const reached = new Set<string>();
  for (const mbti of Object.keys(MBTI_PROFILES) as MbtiId[]) {
    for (const genre of Object.keys(GENRES) as GenreId[]) {
      for (const stage of STAGE_PREFERENCES) {
        for (const sound of SOUND_PREFERENCES) {
          const r = recommendBandCasting({
            mbti, genre, stagePreference: stage.id, soundPreference: sound.id,
            experience: "starter", budget: "under600",
          });
          reached.add(r.primaryPosition);
        }
      }
    }
  }
  assert.equal(reached.size, POSITION_PRIORITY.length);
});

test("songs and gear are always exactly 3 across all experience/budget", () => {
  for (const budget of BUDGETS) {
    for (const exp of EXPERIENCES) {
      const r = recommendBandCasting({ ...base, budget: budget.id, experience: exp.id });
      assert.equal(r.songs.length, 3);
      assert.equal(r.gear.items.length, 3);
    }
  }
});
