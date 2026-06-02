import assert from "node:assert/strict";
import test from "node:test";
import { METRO_STATIONS, getStationNames, findStationByName } from "./metroStations";

test("데이터 로드: 역이 충분히 많다 (>400)", () => {
  assert.ok(METRO_STATIONS.length > 400, `got ${METRO_STATIONS.length}`);
});

test("모든 좌표가 한국 범위(위도 33~39, 경도 124~132) 안", () => {
  for (const s of METRO_STATIONS) {
    assert.ok(s.lat >= 33 && s.lat <= 39, `${s.name} lat ${s.lat}`);
    assert.ok(s.lng >= 124 && s.lng <= 132, `${s.name} lng ${s.lng}`);
  }
});

test("역명 유니크", () => {
  const names = getStationNames();
  assert.equal(new Set(names).size, names.length);
});

test("findStationByName: 정확 매칭은 좌표 반환", () => {
  const s = findStationByName("강남");
  assert.ok(s, "강남 should exist");
  assert.equal(s!.lat, 37.497175);
  assert.equal(s!.lng, 127.027926);
});

test("findStationByName: 앞뒤 공백 트림", () => {
  assert.ok(findStationByName(" 홍대입구 "), "trim should match 홍대입구");
});

test("findStationByName: 없는 역은 null", () => {
  assert.equal(findStationByName("없는역12345"), null);
});
