import assert from "node:assert/strict";
import test from "node:test";
import { maskIp, excerptFromMarkdown, formatColumnDate, timeAgo } from "./columnsFormat";

test("maskIp keeps first two IPv4 octets", () => {
  assert.equal(maskIp("121.131.45.200"), "121.131");
});

test("maskIp handles IPv6 by first two hextets", () => {
  assert.equal(maskIp("2001:db8::1"), "2001:db8");
});

test("maskIp falls back for empty/garbage", () => {
  assert.equal(maskIp(""), "?");
  assert.equal(maskIp("   "), "?");
});

test("excerptFromMarkdown strips markdown and truncates with ellipsis", () => {
  const md = "# 제목\n\n**굵게** 그리고 [링크](https://x.com) 와 `코드`.\n\n![img](/uploads/columns/a.jpg)";
  const out = excerptFromMarkdown(md, 20);
  assert.ok(!out.includes("#"));
  assert.ok(!out.includes("!["));
  assert.ok(!out.includes("https://x.com"));
  assert.ok(out.includes("링크"));
  assert.ok(out.length <= 20);
  assert.ok(out.endsWith("..."));
});

test("excerptFromMarkdown returns whole string when short", () => {
  assert.equal(excerptFromMarkdown("짧은 글", 100), "짧은 글");
});

test("formatColumnDate is YYYY-MM-DD", () => {
  assert.equal(formatColumnDate(new Date(2026, 4, 27)), "2026-05-27");
});

test("timeAgo gives relative korean labels", () => {
  const now = new Date(2026, 4, 27, 12, 0, 0);
  assert.equal(timeAgo(new Date(2026, 4, 27, 11, 59, 30), now), "방금 전");
  assert.equal(timeAgo(new Date(2026, 4, 27, 11, 30, 0), now), "30분 전");
  assert.equal(timeAgo(new Date(2026, 4, 27, 9, 0, 0), now), "3시간 전");
  assert.equal(timeAgo(new Date(2026, 4, 25, 12, 0, 0), now), "2일 전");
});
