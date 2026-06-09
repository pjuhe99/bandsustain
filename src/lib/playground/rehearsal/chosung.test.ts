import assert from "node:assert/strict";
import test from "node:test";
import { toChosung, isChosungQuery } from "./chosung";

test("toChosung: 한글 음절 → 초성", () => {
  assert.equal(toChosung("강남"), "ㄱㄴ");
  assert.equal(toChosung("강남구청"), "ㄱㄴㄱㅊ");
  assert.equal(toChosung("광화문"), "ㄱㅎㅁ");
});

test("toChosung: 비한글은 그대로 보존", () => {
  assert.equal(toChosung("GTX-A"), "GTX-A");
  assert.equal(toChosung("강남2"), "ㄱㄴ2");
});

test("isChosungQuery: 순수 초성만 true", () => {
  assert.equal(isChosungQuery("ㄱㄴ"), true);
  assert.equal(isChosungQuery("ㄱ ㄴ"), true); // 공백 무시
  assert.equal(isChosungQuery("강"), false);
  assert.equal(isChosungQuery("ㄱa"), false);
  assert.equal(isChosungQuery(""), false);
  assert.equal(isChosungQuery("   "), false);
});
