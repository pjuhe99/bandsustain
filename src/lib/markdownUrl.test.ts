import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeMarkdownUrl } from "./markdownUrl";

test("allows http/https/mailto", () => {
  assert.equal(sanitizeMarkdownUrl("https://x.com/a"), "https://x.com/a");
  assert.equal(sanitizeMarkdownUrl("http://x.com"), "http://x.com");
  assert.equal(sanitizeMarkdownUrl("mailto:a@b.com"), "mailto:a@b.com");
});

test("allows site-relative and anchors and bare relative", () => {
  assert.equal(sanitizeMarkdownUrl("/uploads/columns/a.jpg"), "/uploads/columns/a.jpg");
  assert.equal(sanitizeMarkdownUrl("#sec"), "#sec");
  assert.equal(sanitizeMarkdownUrl("foo/bar"), "foo/bar");
});

test("drops dangerous schemes", () => {
  assert.equal(sanitizeMarkdownUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeMarkdownUrl("data:text/html;base64,x"), "");
  assert.equal(sanitizeMarkdownUrl("vbscript:x"), "");
  assert.equal(sanitizeMarkdownUrl("file:///etc/passwd"), "");
});

test("empty stays empty", () => {
  assert.equal(sanitizeMarkdownUrl(""), "");
  assert.equal(sanitizeMarkdownUrl("   "), "");
});
