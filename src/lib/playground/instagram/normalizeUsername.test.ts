import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUsername, toProfileUrl } from "./normalizeUsername";

test("일반 username 정규화", () => {
  assert.equal(normalizeUsername("  @Some_User.99 "), "some_user.99");
});
test("일반 프로필 URL에서 추출", () => {
  assert.equal(normalizeUsername("https://www.instagram.com/2e_1n"), "2e_1n");
  assert.equal(normalizeUsername("https://instagram.com/Abc/"), "abc");
});
test("_u/ 딥링크 URL에서 추출", () => {
  assert.equal(normalizeUsername("https://www.instagram.com/_u/band_sustain"), "band_sustain");
});
test("쿼리스트링 제거", () => {
  assert.equal(normalizeUsername("https://www.instagram.com/abc?hl=ko"), "abc");
});
test("인스타그램 외 도메인 거부", () => {
  assert.equal(normalizeUsername("https://evil.com/abc"), null);
  assert.equal(normalizeUsername("https://instagram.com.evil.com/abc"), null);
});
test("허용 문자 외 거부 (XSS 방어)", () => {
  assert.equal(normalizeUsername('<script>alert(1)</script>'), null);
  assert.equal(normalizeUsername(""), null);
});
test("프로필 링크는 정규형으로 재생성", () => {
  assert.equal(toProfileUrl("abc"), "https://www.instagram.com/abc/");
});
