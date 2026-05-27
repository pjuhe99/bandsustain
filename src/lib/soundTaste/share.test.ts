import assert from "node:assert/strict";
import test from "node:test";
import { DIMENSIONS, QUESTIONS, type SoundVector } from "./data";
import { calculateUserProfile, createTestResult } from "./engine";
import { decodeShareProfile, encodeShareProfile } from "./share";

function profileForSuffix(suffix: string): SoundVector {
  return calculateUserProfile(
    QUESTIONS.map((q) => q.options.find((o) => o.id.endsWith(suffix))!.vector),
  );
}

test("encode/decode 가 모든 대표 프로필을 그대로 복원한다", () => {
  for (const suffix of ["_a", "_b", "_c", "_d"]) {
    const profile = profileForSuffix(suffix);
    const decoded = decodeShareProfile(encodeShareProfile(profile));
    assert.deepEqual(decoded, profile, `${suffix} round-trip 실패`);
  }
});

test("디코드한 프로필로 만든 결과가 원본 결과와 동일하다", () => {
  for (const suffix of ["_a", "_b", "_c", "_d"]) {
    const profile = profileForSuffix(suffix);
    const original = createTestResult(profile);
    const restored = createTestResult(decodeShareProfile(encodeShareProfile(profile))!);
    assert.equal(restored.mainGenre.id, original.mainGenre.id);
    assert.deepEqual(
      restored.recommendedTracks.map((t) => t.id),
      original.recommendedTracks.map((t) => t.id),
    );
  }
});

test("토큰은 URL 경로 안전 문자만 쓴다 (+, /, = 없음)", () => {
  const token = encodeShareProfile(profileForSuffix("_b"));
  assert.ok(!/[+/=]/.test(token), `unsafe chars: ${token}`);
  assert.equal(token, encodeURIComponent(token), "추가 인코딩 필요");
});

test("깨졌거나 악의적인 토큰은 throw 없이 null", () => {
  assert.equal(decodeShareProfile(""), null);
  assert.equal(decodeShareProfile("not-base64!!!"), null);
  assert.equal(decodeShareProfile("e30"), null); // {} → 배열 아님
  // 길이 7 (8 미만)
  assert.equal(decodeShareProfile(btoa(JSON.stringify([1, 2, 3, 4, 5, 0, 1])).replace(/=+$/, "")), null);
});

test("범위(0~5) 밖 값은 거부한다", () => {
  const bad = DIMENSIONS.map(() => 9);
  const token = btoa(JSON.stringify(bad)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  assert.equal(decodeShareProfile(token), null);
});
