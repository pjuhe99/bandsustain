import assert from "node:assert/strict";
import test from "node:test";
import { parseConnectionsHtml } from "./parseConnectionsHtml";

const FOLLOWERS_FIXTURE = `<html><body><main>
<div class="pam _a6-g"><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/2e_1n">2e_1n</a></div><div>6월 06, 2026 10:49 오전</div></div></div></div>
<div class="pam _a6-g"><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/Byeongguk__0714">Byeongguk__0714</a></div><div>6월 06, 2026 12:19 오전</div></div></div></div>
</main></body></html>`;

const FOLLOWING_FIXTURE = `<html><body><main>
<div class="pam _a6-g"><h2 class="_a6-h">band_sustain</h2><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/_u/band_sustain">https://www.instagram.com/_u/band_sustain</a></div><div>9월 22, 2024 10:10 오후</div></div></div></div>
</main></body></html>`;

test("followers: username/링크/날짜 추출", () => {
  const { connections, failedCount } = parseConnectionsHtml(FOLLOWERS_FIXTURE);
  assert.equal(failedCount, 0);
  assert.equal(connections.length, 2);
  assert.deepEqual(connections[0], {
    username: "2e_1n",
    profileUrl: "https://www.instagram.com/2e_1n/",
    followedAt: "2026-06-06T10:49:00",
    followedAtRaw: "6월 06, 2026 10:49 오전",
  });
  assert.equal(connections[1].username, "byeongguk__0714"); // 소문자 정규화
});

test("following: _u/ href에서 username 추출", () => {
  const { connections } = parseConnectionsHtml(FOLLOWING_FIXTURE);
  assert.equal(connections.length, 1);
  assert.equal(connections[0].username, "band_sustain");
  assert.equal(connections[0].profileUrl, "https://www.instagram.com/band_sustain/");
  assert.equal(connections[0].followedAt, "2024-09-22T22:10:00");
});

test("날짜 없는/깨진 항목도 계정은 유지하고 날짜만 null", () => {
  const html = `<a href="https://www.instagram.com/abc">abc</a></div><div>알 수 없는 날짜형식</div>`;
  const { connections } = parseConnectionsHtml(html);
  assert.equal(connections[0].followedAt, null);
  assert.equal(connections[0].followedAtRaw, "알 수 없는 날짜형식");
});

test("인스타그램 외 링크는 무시, 중복 username은 첫 항목 유지", () => {
  const html = `
<a href="https://evil.com/x">x</a>
<a href="https://www.instagram.com/dup">dup</a></div><div>6월 01, 2026 1:00 오전</div>
<a href="https://www.instagram.com/dup">dup</a></div><div>6월 02, 2026 1:00 오전</div>`;
  const { connections } = parseConnectionsHtml(html);
  assert.equal(connections.length, 1);
  assert.equal(connections[0].followedAt, "2026-06-01T01:00:00");
});

test("프로필 외 경로(p/, reel/ 등) 링크는 무시", () => {
  const html = `<a href="https://www.instagram.com/p/Cxyz123">post</a>`;
  assert.equal(parseConnectionsHtml(html).connections.length, 0);
});
