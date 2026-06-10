import assert from "node:assert/strict";
import test from "node:test";
import { validateNickname } from "./nickname";

test("정상 닉네임 (트림 적용)", () => {
  assert.deepEqual(validateNickname("  몽실이 "), { ok: true, value: "몽실이" });
  assert.deepEqual(validateNickname("Rock스타99"), { ok: true, value: "Rock스타99" });
});
test("길이 제한 2~20자", () => {
  assert.equal(validateNickname("a").ok, false);
  assert.equal(validateNickname("가".repeat(21)).ok, false);
  assert.equal(validateNickname("가".repeat(20)).ok, true);
});
test("HTML 태그/꺾쇠 금지", () => {
  assert.equal(validateNickname("<b>몽실</b>").ok, false);
  assert.equal(validateNickname("a<scr").ok, false);
});
test("욕설 필터", () => {
  assert.equal(validateNickname("시발이").ok, false);
  assert.equal(validateNickname("fuckyou").ok, false);
});
test("특수문자 과다 (절반 초과) 금지, 적당한 특수문자는 허용", () => {
  assert.equal(validateNickname("!!!!!!####").ok, false);
  assert.equal(validateNickname("몽실★").ok, true);
});
test("제어문자/줄바꿈 금지", () => {
  assert.equal(validateNickname("몽\n실이").ok, false);
});
