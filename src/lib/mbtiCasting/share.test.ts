// src/lib/mbtiCasting/share.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { encodeCasting, decodeCasting } from "./share";
import type { BandCastingInput } from "./engine";

const input: BandCastingInput = {
  mbti: "ENFP", genre: "jRock", stagePreference: "spotlight",
  soundPreference: "voice", experience: "player", budget: "under1000",
};

// 라이브러리와 동일한 base64url 인코딩(ASCII enum 전용)
function rawToken(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

test("round-trip preserves all six inputs", () => {
  assert.deepEqual(decodeCasting(encodeCasting(input)), input);
});

test("garbage token returns null", () => {
  assert.equal(decodeCasting("!!!not-base64!!!"), null);
  assert.equal(decodeCasting(""), null);
});

test("tampered enum returns null", () => {
  const bad = rawToken(["XXXX", "jRock", "spotlight", "voice", "player", "under1000"]);
  assert.equal(decodeCasting(bad), null);
});

test("wrong-length array returns null", () => {
  assert.equal(decodeCasting(rawToken(["ENFP", "jRock"])), null);
});

test("prototype-chain keys are rejected (constructor/toString)", () => {
  for (const evil of ["constructor", "toString", "valueOf", "hasOwnProperty"]) {
    const bad = rawToken([evil, "jRock", "spotlight", "voice", "player", "under1000"]);
    assert.equal(decodeCasting(bad), null);
    const badGenre = rawToken(["ENFP", evil, "spotlight", "voice", "player", "under1000"]);
    assert.equal(decodeCasting(badGenre), null);
  }
});

test("encoded token is URL-path safe (no + / =)", () => {
  const token = encodeCasting(input);
  assert.ok(!/[+/=]/.test(token), `token contains unsafe chars: ${token}`);
});
