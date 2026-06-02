import assert from "node:assert/strict";
import test from "node:test";
import { timeBucketFor } from "./timeBucket";

test("timeBucketFor: 평일 낮", () => {
  assert.equal(timeBucketFor(new Date("2026-06-03T14:00:00+09:00")), "weekday_day");
});
test("timeBucketFor: 평일 저녁", () => {
  assert.equal(timeBucketFor(new Date("2026-06-03T19:00:00+09:00")), "weekday_evening");
});
test("timeBucketFor: 토요일 낮은 weekend_day", () => {
  assert.equal(timeBucketFor(new Date("2026-06-06T13:00:00+09:00")), "weekend_day");
});
