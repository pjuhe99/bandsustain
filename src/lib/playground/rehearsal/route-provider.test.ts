import assert from "node:assert/strict";
import test from "node:test";
import { MockRouteProvider } from "./route-provider";

const seoul = { lat: 37.5663, lng: 126.9779 };
const gangnam = { lat: 37.4979, lng: 127.0276 };

test("MockRouteProvider: 동일 좌표는 최소 1분", async () => {
  const p = new MockRouteProvider();
  const r = await p.getRoute(seoul, seoul, "transit");
  assert.equal(r.travelMinutes, 1);
  assert.equal(r.distanceMeters, 0);
  assert.equal(r.provider, "mock");
});

test("MockRouteProvider: 거리 멀수록 시간 증가, car 가 transit 보다 빠름", async () => {
  const p = new MockRouteProvider();
  const transit = await p.getRoute(seoul, gangnam, "transit");
  const car = await p.getRoute(seoul, gangnam, "car");
  assert.ok(transit.travelMinutes > 0);
  assert.ok(car.travelMinutes < transit.travelMinutes, `car ${car.travelMinutes} < transit ${transit.travelMinutes}`);
  assert.equal(car.transferCount, 0);
  assert.equal(car.walkingMinutes, 0);
  assert.equal(car.fare, null);
});

test("MockRouteProvider: transit 은 환승/도보/요금 추정값 포함", async () => {
  const p = new MockRouteProvider();
  const r = await p.getRoute(seoul, gangnam, "transit");
  assert.ok(r.transferCount >= 0);
  assert.ok(r.walkingMinutes >= 0);
  assert.ok(r.fare != null && r.fare >= 1400);
});
