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

test("메모리 가드는 만료 키만 제거하고 활성 카운터는 유지", () => {
  const allow = createRateLimiter({ limit: 2, windowMs: 10_000 });
  allow("victim", 0);
  allow("victim", 1); // victim 은 한도 도달
  for (let i = 0; i < 10_001; i++) allow(`spam${i}`, 2);
  assert.equal(allow("victim", 3), false); // clear() 였다면 true 가 되어 우회 성공
});
