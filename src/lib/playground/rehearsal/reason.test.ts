import assert from "node:assert/strict";
import test from "node:test";
import { generateRecommendationReason } from "./reason";
import type { StudioScore } from "./scoring";

function score(partial: Partial<StudioScore>): StudioScore {
  return {
    score: 20, avgMinutes: 20, maxMinutes: 25, minMinutes: 15, spreadMinutes: 5,
    avgTransfer: 0, avgWalking: 5, pricePenalty: 0, capacityPenalty: 0,
    equipmentPenalty: 0, fairnessScore: 5, missingEquipment: [], ...partial,
  };
}

test("평균 이동시간을 항상 포함", () => {
  const r = generateRecommendationReason({ studioName: "A", score: score({ avgMinutes: 18.4 }), hourlyPriceMin: 20000 });
  assert.ok(r.includes("평균 이동 18분"), r);
});

test("편차 작으면 공평 문구", () => {
  const r = generateRecommendationReason({ studioName: "A", score: score({ spreadMinutes: 4 }), hourlyPriceMin: null });
  assert.ok(r.includes("공평"), r);
});

test("장비 문구는 더 이상 노출하지 않음", () => {
  const r = generateRecommendationReason({ studioName: "A", score: score({ missingEquipment: [] }), hourlyPriceMin: null });
  assert.ok(!r.includes("장비"), r);
});

test("가격 있으면 시간당 가격 노출(천단위 콤마)", () => {
  const r = generateRecommendationReason({ studioName: "A", score: score({}), hourlyPriceMin: 22000 });
  assert.ok(r.includes("22,000"), r);
});
