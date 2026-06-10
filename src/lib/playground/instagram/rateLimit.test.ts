import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter } from "./rateLimit";

test("한도 내 허용, 초과 거부, 윈도 경과 후 회복", () => {
  const allow = createRateLimiter({ limit: 3, windowMs: 1000 });
  assert.equal(allow("ip1", 0), true);
  assert.equal(allow("ip1", 10), true);
  assert.equal(allow("ip1", 20), true);
  assert.equal(allow("ip1", 30), false);      // 4번째 거부
  assert.equal(allow("ip2", 30), true);       // 다른 키는 독립
  assert.equal(allow("ip1", 1100), true);     // 윈도 지나면 회복
});
