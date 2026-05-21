import assert from "node:assert/strict";
import test from "node:test";

import { selectCapFallbackReply } from "./yeongminBotFallbackSelect";

const limits = { outputMaxChars: 200, outputMaxLines: 6 };

test("selectCapFallbackReply falls back to default when admin value is null", () => {
  assert.equal(
    selectCapFallbackReply(null, "기본\n문구", limits),
    "기본\n문구",
  );
});

test("selectCapFallbackReply falls back to default when admin value is empty", () => {
  assert.equal(
    selectCapFallbackReply("", "기본\n문구", limits),
    "기본\n문구",
  );
});

test("selectCapFallbackReply falls back to default when admin value is whitespace only", () => {
  assert.equal(
    selectCapFallbackReply("   \n  ", "기본\n문구", limits),
    "기본\n문구",
  );
});

test("selectCapFallbackReply uses admin value when present and within limits", () => {
  assert.equal(
    selectCapFallbackReply("운영자 메시지\n잘 가", "기본", limits),
    "운영자 메시지\n잘 가",
  );
});

test("selectCapFallbackReply clamps overly long admin value", () => {
  const tight = { outputMaxChars: 8, outputMaxLines: 2 };
  assert.equal(
    selectCapFallbackReply("12345678901234\n5678\n9012", "default", tight),
    "12345678",
  );
});
