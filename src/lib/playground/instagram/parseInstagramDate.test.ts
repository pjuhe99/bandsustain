import assert from "node:assert/strict";
import test from "node:test";
import { parseInstagramDate } from "./parseInstagramDate";

test("한국어 오전", () => {
  assert.equal(parseInstagramDate("6월 06, 2026 10:49 오전"), "2026-06-06T10:49:00");
});
test("한국어 오후", () => {
  assert.equal(parseInstagramDate("9월 22, 2024 10:10 오후"), "2024-09-22T22:10:00");
});
test("12시 경계: 오전 12시 = 00시, 오후 12시 = 12시", () => {
  assert.equal(parseInstagramDate("6월 06, 2026 12:19 오전"), "2026-06-06T00:19:00");
  assert.equal(parseInstagramDate("6월 06, 2026 12:19 오후"), "2026-06-06T12:19:00");
});
test("영어 로케일 (약식/전체 월 이름, AM/PM)", () => {
  assert.equal(parseInstagramDate("Jun 06, 2026 10:49 AM"), "2026-06-06T10:49:00");
  assert.equal(parseInstagramDate("September 22, 2024 10:10 PM"), "2024-09-22T22:10:00");
});
test("파싱 불가 시 null (원문은 호출부가 보존)", () => {
  assert.equal(parseInstagramDate("nonsense"), null);
  assert.equal(parseInstagramDate(""), null);
});
