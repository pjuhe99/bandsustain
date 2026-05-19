import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowNameModal } from "./yeongminChatState";

test("shouldShowNameModal returns true when there is no user name yet", () => {
  assert.equal(shouldShowNameModal(null), true);
});

test("shouldShowNameModal returns false once a user name exists", () => {
  assert.equal(shouldShowNameModal("김예빈"), false);
});
