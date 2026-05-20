import assert from "node:assert/strict";
import test from "node:test";
import { generateToken, isValidToken } from "./tokens";

test("generateToken returns 32 hex chars", () => {
  const t = generateToken();
  assert.match(t, /^[a-f0-9]{32}$/);
});

test("generateToken is non-deterministic", () => {
  const a = generateToken();
  const b = generateToken();
  assert.notEqual(a, b);
});

test("isValidToken accepts 32 lowercase hex only", () => {
  assert.equal(isValidToken("a".repeat(32)), true);
  assert.equal(isValidToken("0123456789abcdef0123456789abcdef"), true);
  assert.equal(isValidToken("A".repeat(32)), false); // uppercase rejected
  assert.equal(isValidToken("a".repeat(31)), false);
  assert.equal(isValidToken("a".repeat(33)), false);
  assert.equal(isValidToken("g".repeat(32)), false);
  assert.equal(isValidToken(""), false);
});
