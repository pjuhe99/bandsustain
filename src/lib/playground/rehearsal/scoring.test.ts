import assert from "node:assert/strict";
import test from "node:test";
import { scoreStudioForGroup, type StudioScoreInput } from "./scoring";
import type { RouteResult } from "./types";

function route(min: number, transfer = 0, walk = 0): RouteResult {
  return { travelMinutes: min, transferCount: transfer, walkingMinutes: walk, fare: null, distanceMeters: 0, provider: "mock" };
}

const base: StudioScoreInput = {
  routes: [route(20), route(20)],
  memberCount: 2,
  hourlyPriceMin: 20000,
  maxCapacity: 6,
  studioEquipmentTypes: ["DRUM_SET", "GUITAR_AMP"],
  requiredEquipment: [],
  maxBudgetPerHour: null,
};

test("균등 이동시간이면 score = avg (편차/환승/도보 0)", () => {
  const s = scoreStudioForGroup(base);
  assert.equal(s.avgMinutes, 20);
  assert.equal(s.spreadMinutes, 0);
  assert.equal(s.score, 20);
});

test("이동시간 편차가 크면 score 가 avg 보다 커진다", () => {
  const even = scoreStudioForGroup({ ...base, routes: [route(20), route(20)] });
  const uneven = scoreStudioForGroup({ ...base, routes: [route(10), route(30)] });
  assert.equal(even.avgMinutes, 20);
  assert.equal(uneven.avgMinutes, 20);
  assert.ok(uneven.score > even.score, `uneven ${uneven.score} > even ${even.score}`);
  assert.equal(uneven.score, 20 + 0.7 * 10);
});

test("예산 초과분만큼 price penalty (1000원당 2)", () => {
  const s = scoreStudioForGroup({ ...base, hourlyPriceMin: 25000, maxBudgetPerHour: 20000 });
  assert.equal(s.pricePenalty, (5000 / 1000) * 2);
  assert.equal(s.score, 20 + 10);
});

test("필수장비 누락 1종당 50 penalty", () => {
  const s = scoreStudioForGroup({ ...base, requiredEquipment: ["DRUM_SET", "MIC"] });
  assert.equal(s.equipmentPenalty, 50);
  assert.equal(s.score, 20 + 50);
});

test("수용인원 미달 시 capacity penalty 30", () => {
  const s = scoreStudioForGroup({ ...base, memberCount: 8, maxCapacity: 6 });
  assert.equal(s.capacityPenalty, 30);
});

test("환승/도보 가중 반영", () => {
  const s = scoreStudioForGroup({ ...base, routes: [route(20, 1, 10), route(20, 1, 10)] });
  assert.equal(s.score, 20 + 4 * 1 + 0.15 * 10);
});
