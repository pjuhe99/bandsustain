import assert from "node:assert/strict";
import test from "node:test";
import { matchConnectionFiles } from "./findFiles";

test("표준 경로에서 followers_N/following 매칭 + 숫자 정렬", () => {
  const r = matchConnectionFiles([
    "start_here.html",
    "connections/followers_and_following/followers_10.html",
    "connections/followers_and_following/followers_2.html",
    "connections/followers_and_following/followers_1.html",
    "connections/followers_and_following/following.html",
    "connections/followers_and_following/blocked_profiles.html",
    "media/other/123.jpg",
  ]);
  assert.deepEqual(r.followers, [
    "connections/followers_and_following/followers_1.html",
    "connections/followers_and_following/followers_2.html",
    "connections/followers_and_following/followers_10.html",
  ]);
  assert.equal(r.following, "connections/followers_and_following/following.html");
});

test("followers.html (숫자 없음) / 대소문자 차이 / 루트 폴백", () => {
  const r = matchConnectionFiles(["Followers.HTML", "FOLLOWING.html"]);
  assert.deepEqual(r.followers, ["Followers.HTML"]);
  assert.equal(r.following, "FOLLOWING.html");
});

test("recently_unfollowed 등 유사 파일은 매칭 안 됨", () => {
  const r = matchConnectionFiles([
    "connections/followers_and_following/recently_unfollowed_profiles.html",
    "connections/followers_and_following/recent_follow_requests.html",
  ]);
  assert.deepEqual(r.followers, []);
  assert.equal(r.following, null);
});
