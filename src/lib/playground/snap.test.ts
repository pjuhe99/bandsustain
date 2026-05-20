import assert from "node:assert/strict";
import test from "node:test";
import { snapTo025 } from "./snap";

test("snapTo025 rounds to nearest 0.25", () => {
  assert.equal(snapTo025(0), 0);
  assert.equal(snapTo025(0.1), 0);
  assert.equal(snapTo025(0.13), 0.25);
  assert.equal(snapTo025(0.25), 0.25);
  assert.equal(snapTo025(0.37), 0.25);
  assert.equal(snapTo025(0.38), 0.5);
  assert.equal(snapTo025(-0.13), -0.25); // -0.13 is 0.12 from -0.25, 0.13 from 0 → rounds to -0.25
  assert.equal(snapTo025(-0.37), -0.25);
  assert.equal(snapTo025(-0.38), -0.5);
});
