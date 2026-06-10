import assert from "node:assert/strict";
import test from "node:test";
import { calculateRelations } from "./relations";
import type { InstagramConnection } from "./types";

function conn(username: string, followedAt: string | null = null): InstagramConnection {
  return {
    username,
    profileUrl: `https://www.instagram.com/${username}/`,
    followedAt,
    followedAtRaw: followedAt,
  };
}

test("mutual / notFollowingMeBack / iDoNotFollowBack 분리 + 양쪽 날짜 보존", () => {
  const followers = [conn("a", "2025-09-03T10:00:00"), conn("b")];
  const following = [conn("a", "2025-08-12T10:00:00"), conn("c", "2025-01-01T10:00:00")];
  const r = calculateRelations(followers, following);

  assert.deepEqual(r.mutuals.map((x) => x.username), ["a"]);
  assert.equal(r.mutuals[0].followerSince, "2025-09-03T10:00:00");
  assert.equal(r.mutuals[0].followingSince, "2025-08-12T10:00:00");
  assert.deepEqual(r.notFollowingMeBack.map((x) => x.username), ["c"]);
  assert.deepEqual(r.iDoNotFollowBack.map((x) => x.username), ["b"]);
  assert.equal(r.followers.length, 2);
  assert.equal(r.following.length, 2);
});

test("입력 중복은 1회만 반영 (파서가 이미 dedup하지만 방어)", () => {
  const r = calculateRelations([conn("a"), conn("a")], []);
  assert.equal(r.followers.length, 1);
});

test("빈 입력", () => {
  const r = calculateRelations([], []);
  assert.deepEqual(r.mutuals, []);
  assert.deepEqual(r.notFollowingMeBack, []);
});
