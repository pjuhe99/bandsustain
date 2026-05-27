import test from "node:test";
import assert from "node:assert/strict";
import { GENRE_TO_SCENE, buildNameGenQuery } from "./nameGenLink";
import { GENRES } from "./data";
import type { GenreId } from "./types";
import { sceneOptions, moodOptions } from "../bandName/options";

const validScenes = new Set(sceneOptions.map((o) => o.value));
const validMoods = new Set(moodOptions.map((o) => o.value));

test("every genre maps to a valid generator scene", () => {
  for (const g of Object.keys(GENRES) as GenreId[]) {
    assert.ok(validScenes.has(GENRE_TO_SCENE[g]));
  }
});

test("buildNameGenQuery always includes a valid scene", () => {
  for (const g of Object.keys(GENRES) as GenreId[]) {
    const qs = new URLSearchParams(buildNameGenQuery(g, []));
    assert.ok(qs.get("scene") && validScenes.has(qs.get("scene") as never));
  }
});

test("mood param, when present, is a valid generator mood", () => {
  const qs = new URLSearchParams(buildNameGenQuery("jRock", ["청춘", "질주"]));
  const mood = qs.get("mood");
  if (mood !== null) assert.ok(validMoods.has(mood as never));
});

test("unmapped mood tags omit the mood param", () => {
  const qs = new URLSearchParams(buildNameGenQuery("jRock", ["존재하지않는태그"]));
  assert.equal(qs.get("mood"), null);
});

test("first matching mood tag wins", () => {
  // 몽환 → dreamy, 청춘 → fresh; 첫 매칭(dreamy)이 선택돼야 한다.
  const qs = new URLSearchParams(buildNameGenQuery("jRock", ["몽환", "청춘"]));
  assert.equal(qs.get("mood"), "dreamy");
});
