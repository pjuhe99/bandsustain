import assert from "node:assert/strict";
import test from "node:test";

import { deriveSceneCategories } from "./sceneCategories";
import { defaultDataset } from "./data";

test("deriveSceneCategories maps each scene to the sorted union of its patterns' slots", () => {
  const map = deriveSceneCategories([
    { scenes: ["jrock", "emo"], slots: ["time", "place"] },
    { scenes: ["jrock"], slots: ["season", "analog"] },
    { scenes: ["metal"], slots: ["doom", "ritual"] },
  ]);
  assert.deepEqual(map.jrock, ["analog", "place", "season", "time"]);
  assert.deepEqual(map.emo, ["place", "time"]);
  assert.deepEqual(map.metal, ["doom", "ritual"]);
});

test("metal categories are exclusive to the metal scene in the real dataset", () => {
  const map = deriveSceneCategories(
    [...defaultDataset.koreanPatterns, ...defaultDataset.englishPatterns].map((p) => ({
      scenes: p.scenes,
      slots: p.slots,
    })),
  );
  for (const cat of ["metalMaterial", "doom", "ritual", "beast"]) {
    for (const [scene, cats] of Object.entries(map)) {
      if (scene !== "metal") {
        assert.ok(!cats.includes(cat), `${cat} should not appear under ${scene}`);
      }
    }
    assert.ok(map.metal.includes(cat), `metal should include ${cat}`);
  }
  // 공용 카테고리는 여러 씬에 걸쳐 나타난다 (예: color 는 거의 모든 씬).
  const scenesWithColor = Object.entries(map).filter(([, cats]) => cats.includes("color"));
  assert.ok(scenesWithColor.length >= 5, "color should be shared across many scenes");
});
