import assert from "node:assert/strict";
import test from "node:test";

import { decodeShare, encodeShare, shareTagsFor } from "./share";
import type { SharePayload } from "./share";

const SAMPLES: SharePayload[] = [
  { name: "새벽옥상", scene: "jrock", mood: "fresh" },
  { name: "SUNSET 카세트", scene: "citypop", mood: "romantic" },
  { name: "DEAD BATTERY", scene: "punk", mood: "rough" },
  { name: "삼각김밥방송국", scene: "hongdae", mood: "funny" },
];

test("encode/decode round-trips every payload", () => {
  for (const s of SAMPLES) {
    const decoded = decodeShare(encodeShare(s));
    assert.deepEqual(decoded, s, `round-trip failed for ${s.name}`);
  }
});

test("token is URL-path safe (no +, /, =)", () => {
  for (const s of SAMPLES) {
    const token = encodeShare(s);
    assert.ok(!/[+/=]/.test(token), `unsafe chars in token: ${token}`);
    assert.equal(token, encodeURIComponent(token), `token needs further encoding: ${token}`);
  }
});

test("malformed or hostile tokens decode to null (never throw)", () => {
  assert.equal(decodeShare(""), null);
  assert.equal(decodeShare("not-base64!!!"), null);
  assert.equal(decodeShare("e30"), null); // {} → not array
  assert.equal(decodeShare(encodeShare({ name: "", scene: "jrock", mood: "fresh" } as SharePayload)), null);
});

test("invalid scene/mood rejected", () => {
  const badScene = encodeShare({ name: "x", scene: "jazz" as never, mood: "fresh" });
  const badMood = encodeShare({ name: "x", scene: "jrock", mood: "angry" as never });
  assert.equal(decodeShare(badScene), null);
  assert.equal(decodeShare(badMood), null);
});

test("over-long names rejected (URL abuse guard)", () => {
  const token = encodeShare({ name: "가".repeat(41), scene: "jrock", mood: "fresh" });
  assert.equal(decodeShare(token), null);
});

test("shareTagsFor returns scene + mood labels", () => {
  assert.deepEqual(shareTagsFor({ name: "새벽옥상", scene: "jrock", mood: "fresh" }), [
    "J-ROCK",
    "청량함",
  ]);
});
