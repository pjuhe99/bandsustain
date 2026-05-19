import assert from "node:assert/strict";
import test from "node:test";

import { buildUserNameContext, normalizeUserNameInput } from "./yeongminUserName";

test("normalizeUserNameInput trims and collapses whitespace", () => {
  assert.equal(normalizeUserNameInput("  김예빈  "), "김예빈");
  assert.equal(normalizeUserNameInput("  Kim   Yebin "), "Kim Yebin");
});

test("normalizeUserNameInput rejects empty or too long names", () => {
  assert.equal(normalizeUserNameInput("   "), null);
  assert.equal(normalizeUserNameInput("a".repeat(31)), null);
});

test("buildUserNameContext derives a casual Korean call name from a three-syllable full name", () => {
  assert.deepEqual(buildUserNameContext("김예빈"), {
    preferredName: "김예빈",
    casualName: "예빈",
  });
});

test("buildUserNameContext keeps the preferred name when no better casual form exists", () => {
  assert.deepEqual(buildUserNameContext("예빈"), {
    preferredName: "예빈",
    casualName: "예빈",
  });
  assert.deepEqual(buildUserNameContext("Kim Yebin"), {
    preferredName: "Kim Yebin",
    casualName: "Kim Yebin",
  });
});
