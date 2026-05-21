import test from "node:test";
import assert from "node:assert/strict";
import { groupConsecutiveBy } from "./groupConsecutive";

test("empty array returns empty", () => {
  assert.deepEqual(groupConsecutiveBy([], (x: number) => x), []);
});

test("single key throughout returns one group", () => {
  const items = [
    { mid: 1, n: "a" },
    { mid: 1, n: "b" },
    { mid: 1, n: "c" },
  ];
  const out = groupConsecutiveBy(items, (it) => it.mid);
  assert.equal(out.length, 1);
  assert.equal(out[0].key, 1);
  assert.deepEqual(out[0].items.map((x) => x.n), ["a", "b", "c"]);
});

test("ABA pattern produces 3 groups (admin order respected)", () => {
  const items = [
    { mid: 1, n: "a1" },
    { mid: 1, n: "a2" },
    { mid: 2, n: "b1" },
    { mid: 1, n: "a3" },
  ];
  const out = groupConsecutiveBy(items, (it) => it.mid);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((g) => g.key), [1, 2, 1]);
  assert.deepEqual(out[0].items.map((x) => x.n), ["a1", "a2"]);
  assert.deepEqual(out[1].items.map((x) => x.n), ["b1"]);
  assert.deepEqual(out[2].items.map((x) => x.n), ["a3"]);
});

test("key comparison is value-based (not identity)", () => {
  // Two distinct object literals with same .id should group together.
  const a = { id: 7 };
  const b = { id: 7 };
  const out = groupConsecutiveBy([{ k: a }, { k: b }], (x) => x.k.id);
  assert.equal(out.length, 1);
  assert.equal(out[0].items.length, 2);
});
