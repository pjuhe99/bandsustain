import assert from "node:assert/strict";
import test from "node:test";
import { createBloom, bloomAdd, bloomHas, serializeBloom, deserializeBloom } from "./bloom";

test("멤버십: 추가한 항목은 전부 true", () => {
  const f = createBloom(1000, 0.01);
  const items = Array.from({ length: 1000 }, (_, i) => `user_${i}.name`);
  for (const s of items) bloomAdd(f, s);
  for (const s of items) assert.equal(bloomHas(f, s), true);
});

test("미포함 항목의 오탐율은 ~1% 수준 (< 3%)", () => {
  const f = createBloom(1000, 0.01);
  for (let i = 0; i < 1000; i++) bloomAdd(f, `member_${i}`);
  let fp = 0;
  for (let i = 0; i < 10000; i++) if (bloomHas(f, `absent_${i}`)) fp++;
  assert.ok(fp < 300, `false positives: ${fp}`);
});

test("직렬화/역직렬화 라운드트립", () => {
  const f = createBloom(500, 0.01);
  bloomAdd(f, "band_sustain");
  bloomAdd(f, "iu.official");
  const buf = serializeBloom(f);
  const g = deserializeBloom(buf);
  assert.equal(g.m, f.m);
  assert.equal(g.k, f.k);
  assert.equal(g.count, f.count);
  assert.equal(bloomHas(g, "band_sustain"), true);
  assert.equal(bloomHas(g, "iu.official"), true);
  assert.equal(bloomHas(g, "never_added_xyz"), false);
});

test("잘못된 매직/버전은 throw", () => {
  assert.throws(() => deserializeBloom(new Uint8Array([1, 2, 3, 4, 5])));
  const f = createBloom(10, 0.01);
  const buf = serializeBloom(f);
  buf[0] = 0x58; // 매직 훼손
  assert.throws(() => deserializeBloom(buf));
});

test("빈 필터는 전부 false", () => {
  const f = createBloom(100, 0.01);
  assert.equal(bloomHas(f, "anything"), false);
});

test("용량 0/음수는 throw (전부-true 퇴화 방지)", () => {
  assert.throws(() => createBloom(0, 0.01));
  assert.throws(() => createBloom(-5, 0.01));
});
