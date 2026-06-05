import assert from "node:assert/strict";
import test from "node:test";
import { parseRegion, priceBucketMatch, applyStudioFilters, type StudioFilter } from "./filter";
import type { Studio } from "./types";

const EMPTY: StudioFilter = { city: null, gus: [], instrumentTypes: [], priceBucket: null, capacityMin: null, parkingOnly: false, rentalOnly: false };

function studio(over: Partial<Studio> & { rooms: Studio["rooms"] }): Studio {
  return {
    id: 1, name: "S", slug: "s", regionId: null, regionName: null, areaLabel: "서울, 역삼",
    roadAddress: "서울특별시 강남구 논현로 404", phone: null,
    lat: 37.5, lng: 127, nearestStation: null, nearestStationMeters: null,
    hourlyPriceMin: 20000, hourlyPriceMax: 20000, minCapacity: null, maxCapacity: null,
    hasParking: false, parkingNote: null, status: "approved", sourceNote: null,
    bookingUrl: null, mapUrl: null, bookingMethod: null, amenities: null, homepageUrl: null,
    equipment: [], equipmentTypes: [], ...over,
  } as Studio;
}
function room(over: Partial<Studio["rooms"][number]>): Studio["rooms"][number] {
  return { id: 1, name: "A", hourlyPrice: 20000, capacity: 10, equipment: [], review: null, ...over };
}

test("parseRegion: 시·구 추출 + 폴백", () => {
  assert.deepEqual(parseRegion("서울특별시 마포구 양화로 12", null), { city: "서울", gu: "마포구" });
  assert.deepEqual(parseRegion("경기도 성남시 분당구 판교로 441", null), { city: "성남", gu: "분당구" });
  assert.deepEqual(parseRegion(null, "수원, 인계"), { city: "수원", gu: null });
  assert.deepEqual(parseRegion(null, null), { city: null, gu: null });
});

test("priceBucketMatch: 경계(상한 포함)", () => {
  assert.equal(priceBucketMatch(15000, "u15"), true);
  assert.equal(priceBucketMatch(15001, "u15"), false);
  assert.equal(priceBucketMatch(20000, "15_20"), true);
  assert.equal(priceBucketMatch(25001, "o25"), true);
  assert.equal(priceBucketMatch(null, "u15"), false);
});

test("지역 필터: 시+구", () => {
  const a = studio({ roadAddress: "서울특별시 마포구 양화로 12", rooms: [room({})] });
  const b = studio({ roadAddress: "경기도 성남시 분당구 판교로 441", rooms: [room({})] });
  assert.equal(applyStudioFilters([a, b], { ...EMPTY, city: "서울" }).studios.length, 1);
  assert.equal(applyStudioFilters([a, b], { ...EMPTY, city: "서울", gus: ["서초구"] }).studios.length, 0);
  assert.equal(applyStudioFilters([a, b], { ...EMPTY, city: "서울", gus: ["마포구"] }).studios.length, 1);
});

test("악기 AND: 한 방에 모두", () => {
  const ok = studio({ rooms: [room({ equipment: [{ name: "x", type: "DRUM" }, { name: "y", type: "BASS_AMP" }] })] });
  const split = studio({ rooms: [room({ equipment: [{ name: "x", type: "DRUM" }] }), room({ equipment: [{ name: "y", type: "BASS_AMP" }] })] });
  const f: StudioFilter = { ...EMPTY, instrumentTypes: ["DRUM", "BASS_AMP"] };
  assert.equal(applyStudioFilters([ok], f).studios.length, 1);
  assert.equal(applyStudioFilters([split], f).studios.length, 0); // 두 방에 나뉘면 제외
});

test("정보 없음(방 0): 방 조건 걸면 noInfo 로 분리, 안 걸면 studios 포함", () => {
  const naver = studio({ name: "네이버만", hourlyPriceMin: null, hourlyPriceMax: null, rooms: [] });
  const full = studio({ rooms: [room({})] });
  const empty = applyStudioFilters([naver, full], EMPTY);
  assert.equal(empty.studios.length, 2);   // 조건 없음 → 모두 노출
  assert.equal(empty.noInfo.length, 0);
  const priced = applyStudioFilters([naver, full], { ...EMPTY, priceBucket: "15_20" });
  assert.deepEqual(priced.studios.map((s) => s.name), ["S"]);
  assert.deepEqual(priced.noInfo.map((s) => s.name), ["네이버만"]); // 판단불가 분리
  // 지역 불일치면 noInfo 에도 안 들어감
  const off = applyStudioFilters([naver], { ...EMPTY, city: "성남", priceBucket: "15_20" });
  assert.equal(off.noInfo.length, 0);
});

test("가격/인원/주차/악기대여 + 정렬(null 뒤)", () => {
  const cheap = studio({ name: "C", hourlyPriceMin: 12000, rooms: [room({ hourlyPrice: 12000, capacity: 5 })] });
  const mid = studio({ name: "M", hourlyPriceMin: 22000, hasParking: true, amenities: "악기대여 O, 주차 O", rooms: [room({ hourlyPrice: 22000, capacity: 15 })] });
  const noPrice = studio({ name: "N", hourlyPriceMin: null, hourlyPriceMax: null, rooms: [] });
  assert.deepEqual(applyStudioFilters([cheap, mid], { ...EMPTY, priceBucket: "20_25" }).studios.map((s) => s.name), ["M"]);
  assert.deepEqual(applyStudioFilters([cheap, mid], { ...EMPTY, capacityMin: 10 }).studios.map((s) => s.name), ["M"]);
  assert.equal(applyStudioFilters([cheap, mid], { ...EMPTY, parkingOnly: true }).studios.length, 1);
  assert.equal(applyStudioFilters([cheap, mid], { ...EMPTY, rentalOnly: true }).studios.length, 1);
  assert.deepEqual(applyStudioFilters([noPrice, mid, cheap], EMPTY).studios.map((s) => s.name), ["C", "M", "N"]); // null 마지막
});
