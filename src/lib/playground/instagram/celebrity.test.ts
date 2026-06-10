import assert from "node:assert/strict";
import test from "node:test";
import { classify } from "./celebrity";
import { createBloom, bloomAdd } from "./bloom";

function filterWith(...names: string[]) {
  const f = createBloom(100, 0.001);
  for (const n of names) bloomAdd(f, n);
  return f;
}

test("수동 보정이 최우선 (필터 매칭을 뒤집음)", () => {
  const f = filterWith("celeb_in_list");
  assert.equal(classify("celeb_in_list", f, { celeb_in_list: "person" }), "person");
  assert.equal(classify("plain_user", f, { plain_user: "celebrity" }), "celebrity");
});

test("블룸필터 매칭 → celebrity", () => {
  const f = filterWith("dlwlrma");
  assert.equal(classify("dlwlrma", f, {}), "celebrity");
  assert.equal(classify("my_friend_kim", f, {}), "person");
});

test("휴리스틱: 계정명에 official 포함 → celebrity (필터 미매칭이어도)", () => {
  const f = filterWith();
  assert.equal(classify("smtown_official", f, {}), "celebrity");
  assert.equal(classify("officialbts", f, {}), "celebrity");
  assert.equal(classify("unofficialfan", f, {}), "celebrity"); // 한계 — 허용 (추정 배지 + 수동 해제)
});

test("필터 null (로드 실패) 시 보정과 휴리스틱만 동작", () => {
  assert.equal(classify("dlwlrma", null, {}), "person");
  assert.equal(classify("dlwlrma", null, { dlwlrma: "celebrity" }), "celebrity");
  assert.equal(classify("x_official", null, {}), "celebrity");
});

test("프로토타입 속성명 username 은 person (hasOwn 가드)", () => {
  assert.equal(classify("constructor", null, {}), "person");
  assert.equal(classify("__proto__", null, {}), "person");
});
