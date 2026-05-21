import test from "node:test";
import assert from "node:assert/strict";
import { normalizePinInput } from "./normalizePinInput";

test("undefined → null", () => {
  assert.equal(normalizePinInput(undefined), null);
});

test("empty string → null", () => {
  assert.equal(normalizePinInput(""), null);
});

test("whitespace-only → null", () => {
  assert.equal(normalizePinInput("   \t  "), null);
});

test("trims surrounding whitespace", () => {
  assert.equal(normalizePinInput("  hello  "), "hello");
});

test("collapses newlines to single space", () => {
  assert.equal(normalizePinInput("hi\nworld"), "hi world");
  assert.equal(normalizePinInput("hi\r\nworld"), "hi world");
  assert.equal(normalizePinInput("hi\rworld"), "hi world");
});

test("collapses consecutive newlines into single space", () => {
  assert.equal(normalizePinInput("a\n\n\nb"), "a b");
});

test("preserves internal single spaces but trims surroundings + newlines", () => {
  assert.equal(normalizePinInput("  hi  \nworld  "), "hi   world");
});
