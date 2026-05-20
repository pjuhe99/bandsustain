import assert from "node:assert/strict";
import test from "node:test";
import { canViewLayout, canMutateLayout } from "./visibility";

const OWNER = "a".repeat(32);
const OTHER = "b".repeat(32);

test("canViewLayout for private — only owner", () => {
  const l = { visibility: "private" as const, owner_token: OWNER };
  assert.equal(canViewLayout(l, OWNER), true);
  assert.equal(canViewLayout(l, OTHER), false);
  assert.equal(canViewLayout(l, null), false);
});

test("canViewLayout for unlisted — anyone with the URL", () => {
  const l = { visibility: "unlisted" as const, owner_token: OWNER };
  assert.equal(canViewLayout(l, OWNER), true);
  assert.equal(canViewLayout(l, OTHER), true);
  assert.equal(canViewLayout(l, null), true);
});

test("canViewLayout for public — anyone", () => {
  const l = { visibility: "public" as const, owner_token: OWNER };
  assert.equal(canViewLayout(l, OWNER), true);
  assert.equal(canViewLayout(l, OTHER), true);
  assert.equal(canViewLayout(l, null), true);
});

test("canMutateLayout — only owner regardless of visibility", () => {
  for (const v of ["private", "unlisted", "public"] as const) {
    const l = { visibility: v, owner_token: OWNER };
    assert.equal(canMutateLayout(l, OWNER), true);
    assert.equal(canMutateLayout(l, OTHER), false);
    assert.equal(canMutateLayout(l, null), false);
  }
});
