import assert from "node:assert/strict";
import test from "node:test";
import { filterStudiosByConditions, prefilterByCentroid, rankStudios } from "./ranker";
import type { Studio, RouteResult } from "./types";

function studio(p: Partial<Studio>): Studio {
  return {
    id: 1, name: "S", slug: "s", regionId: 1, regionName: "서울 마포구", areaLabel: null,
    roadAddress: null, lat: 37.55, lng: 126.92, nearestStation: null, nearestStationMeters: null,
    hourlyPriceMin: 20000, hourlyPriceMax: 25000, minCapacity: 1, maxCapacity: 6,
    hasParking: false, parkingNote: null, status: "approved", sourceNote: null,
    bookingUrl: null, mapUrl: null, bookingMethod: null, amenities: null, homepageUrl: null,
    equipment: [], rooms: [], equipmentTypes: [], ...p,
  };
}
function route(min: number): RouteResult {
  return { travelMinutes: min, transferCount: 0, walkingMinutes: 0, fare: null, distanceMeters: 0, provider: "mock" };
}

test("filter: 수용인원 미달 제외", () => {
  const out = filterStudiosByConditions(
    [studio({ id: 1, maxCapacity: 4 }), studio({ id: 2, maxCapacity: 8 })],
    { memberCount: 6, maxBudgetPerHour: null, requiredEquipment: [], preferredRegionIds: [] },
  );
  assert.deepEqual(out.map((s) => s.id), [2]);
});

test("filter: 예산 초과(price_min > 예산) 제외", () => {
  const out = filterStudiosByConditions(
    [studio({ id: 1, hourlyPriceMin: 30000 }), studio({ id: 2, hourlyPriceMin: 18000 })],
    { memberCount: 2, maxBudgetPerHour: 20000, requiredEquipment: [], preferredRegionIds: [] },
  );
  assert.deepEqual(out.map((s) => s.id), [2]);
});

test("filter: 필수장비 보유만 통과", () => {
  const withDrum = studio({ id: 1, equipment: [{ equipmentType: "DRUM_SET", equipmentName: null, quantity: 1, note: null }] });
  const without = studio({ id: 2, equipment: [] });
  const out = filterStudiosByConditions([withDrum, without], { memberCount: 2, maxBudgetPerHour: null, requiredEquipment: ["DRUM_SET"], preferredRegionIds: [] });
  assert.deepEqual(out.map((s) => s.id), [1]);
});

test("filter: preferred_region 지정 시 해당 지역만", () => {
  const out = filterStudiosByConditions(
    [studio({ id: 1, regionId: 5 }), studio({ id: 2, regionId: 9 })],
    { memberCount: 2, maxBudgetPerHour: null, requiredEquipment: [], preferredRegionIds: [9] },
  );
  assert.deepEqual(out.map((s) => s.id), [2]);
});

test("prefilter: 중심점 가까운 상위 N", () => {
  const near = studio({ id: 1, lat: 37.50, lng: 127.00 });
  const far = studio({ id: 2, lat: 37.80, lng: 127.50 });
  const out = prefilterByCentroid([far, near], { lat: 37.50, lng: 127.0 }, 1);
  assert.deepEqual(out.map((s) => s.id), [1]);
});

test("rank: 점수 오름차순(낮을수록 상위), rank_no 1부터", () => {
  const a = studio({ id: 1 });
  const b = studio({ id: 2 });
  const routesByStudio = new Map<number, RouteResult[]>([
    [1, [route(10), route(10)]],
    [2, [route(30), route(30)]],
  ]);
  const ranked = rankStudios({
    studios: [a, b], routesByStudioId: routesByStudio,
    conditions: { memberCount: 2, maxBudgetPerHour: null, requiredEquipment: [], preferredRegionIds: [] },
    limit: 5,
  });
  assert.deepEqual(ranked.map((r) => r.studio.id), [1, 2]);
  assert.equal(ranked[0].rankNo, 1);
  assert.equal(ranked[1].rankNo, 2);
  assert.ok(ranked[0].reason.length > 0);
});
