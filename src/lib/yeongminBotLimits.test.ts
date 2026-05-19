import assert from "node:assert/strict";
import test from "node:test";

import {
  clampReply,
  isInputTooLong,
  type OutputLimitOptions,
} from "./yeongminBotLimits";

test("isInputTooLong returns true only when the limit is exceeded", () => {
  assert.equal(isInputTooLong("hello", 10), false);
  assert.equal(isInputTooLong("1234567890", 10), false);
  assert.equal(isInputTooLong("12345678901", 10), true);
});

test("clampReply trims by line count first", () => {
  const limited = clampReply("a\nb\nc\nd", {
    outputMaxChars: 100,
    outputMaxLines: 2,
  });

  assert.equal(limited, "a\nb");
});

test("clampReply trims by char count after line trimming", () => {
  const limited = clampReply("abcdef\nghijkl", {
    outputMaxChars: 8,
    outputMaxLines: 4,
  });

  assert.equal(limited, "abcdef\ng");
});

test("clampReply returns trimmed content unchanged when within limits", () => {
  const opts: OutputLimitOptions = {
    outputMaxChars: 20,
    outputMaxLines: 3,
  };

  assert.equal(clampReply(" hello \nthere ", opts), "hello \nthere");
});
