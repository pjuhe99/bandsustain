import assert from "node:assert/strict";
import test from "node:test";
import { followDayCount, formatKoreanDate } from "./followDays";

test("팔로우 당일은 1일째 (시각이 달라도)", () => {
  assert.equal(followDayCount("2026-06-06T23:59:00", new Date(2026, 5, 6, 0, 1)), 1);
});
test("다음날은 2일째 (자정 직후)", () => {
  assert.equal(followDayCount("2026-06-06T10:00:00", new Date(2026, 5, 7, 0, 0, 1)), 2);
});
test("윤년 포함 구간 (2024-02-28 → 2024-03-01 = 3일째, 2/29 존재)", () => {
  assert.equal(followDayCount("2024-02-28T00:00:00", new Date(2024, 2, 1)), 3);
});
test("실측 fixture: band_sustain 2024-09-22 → 2026-06-10 = 627일째", () => {
  assert.equal(followDayCount("2024-09-22T22:10:00", new Date(2026, 5, 10)), 627);
});
test("미래 날짜 방어", () => {
  assert.equal(followDayCount("2026-06-11T00:00:00", new Date(2026, 5, 10)), null);
});
test("잘못된 입력", () => {
  assert.equal(followDayCount("not-a-date", new Date(2026, 5, 10)), null);
});
test("한국어 날짜 포맷", () => {
  assert.equal(formatKoreanDate("2024-09-22T22:10:00"), "2024년 9월 22일");
});
