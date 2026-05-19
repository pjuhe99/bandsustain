import assert from "node:assert/strict";
import test from "node:test";

import { remainingDelayMs } from "./yeongminDelay";

test("remainingDelayMs returns the leftover time when elapsed is below the minimum", () => {
  assert.equal(remainingDelayMs(250, 2000), 1750);
});

test("remainingDelayMs returns zero when elapsed already exceeds the minimum", () => {
  assert.equal(remainingDelayMs(2200, 2000), 0);
});
