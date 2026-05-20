import assert from "node:assert/strict";
import test from "node:test";
import { ROTATIONS, rotateLeft, rotateRight, isValidRotation } from "./rotate";

test("ROTATIONS is the four 90deg increments in order", () => {
  assert.deepEqual(ROTATIONS, [0, 90, 180, 270]);
});

test("rotateRight cycles 0 → 90 → 180 → 270 → 0", () => {
  assert.equal(rotateRight(0), 90);
  assert.equal(rotateRight(90), 180);
  assert.equal(rotateRight(180), 270);
  assert.equal(rotateRight(270), 0);
});

test("rotateLeft cycles 0 → 270 → 180 → 90 → 0", () => {
  assert.equal(rotateLeft(0), 270);
  assert.equal(rotateLeft(270), 180);
  assert.equal(rotateLeft(180), 90);
  assert.equal(rotateLeft(90), 0);
});

test("isValidRotation accepts only 0/90/180/270", () => {
  assert.equal(isValidRotation(0), true);
  assert.equal(isValidRotation(90), true);
  assert.equal(isValidRotation(180), true);
  assert.equal(isValidRotation(270), true);
  assert.equal(isValidRotation(45), false);
  assert.equal(isValidRotation(360), false);
  assert.equal(isValidRotation(-90), false);
});
