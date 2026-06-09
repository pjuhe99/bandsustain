import assert from "node:assert/strict";
import test from "node:test";
import { haversineMeters, centroid, roundCoord } from "./geo";

test("haversineMeters: 동일 좌표는 0", () => {
  assert.equal(haversineMeters({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 }), 0);
});

test("haversineMeters: 서울시청~강남역 ~ 8.5km 근사", () => {
  const d = haversineMeters({ lat: 37.5663, lng: 126.9779 }, { lat: 37.4979, lng: 127.0276 });
  assert.ok(d > 8000 && d < 9500, `got ${d}`);
});

test("centroid: 두 점의 중점", () => {
  const c = centroid([{ lat: 0, lng: 0 }, { lat: 2, lng: 4 }]);
  assert.deepEqual(c, { lat: 1, lng: 2 });
});

test("centroid: 빈 배열은 throw", () => {
  assert.throws(() => centroid([]));
});

test("roundCoord: 소수 3자리 반올림", () => {
  assert.equal(roundCoord(37.566789), 37.567);
  assert.equal(roundCoord(126.97712), 126.977);
});
