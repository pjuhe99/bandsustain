import assert from "node:assert/strict";
import test from "node:test";
import { commentInputSchema, topicSchema, postSchema } from "./columnsValidation";

test("commentInputSchema accepts valid input", () => {
  const r = commentInputSchema.safeParse({ nickname: "영민팬", body: "좋은 글이에요" });
  assert.ok(r.success);
});

test("commentInputSchema rejects empty nickname/body", () => {
  assert.ok(!commentInputSchema.safeParse({ nickname: "", body: "x" }).success);
  assert.ok(!commentInputSchema.safeParse({ nickname: "a", body: "" }).success);
});

test("commentInputSchema rejects too-long body", () => {
  assert.ok(!commentInputSchema.safeParse({ nickname: "a", body: "x".repeat(1001) }).success);
});

test("commentInputSchema rejects short password but allows empty", () => {
  assert.ok(!commentInputSchema.safeParse({ nickname: "a", body: "b", password: "12" }).success);
  assert.ok(commentInputSchema.safeParse({ nickname: "a", body: "b", password: "" }).success);
});

test("topicSchema coerces optional memberId and defaults sortOrder", () => {
  const r = topicSchema.safeParse({ title: "역사갤러리", memberId: "", description: "", sortOrder: "" });
  assert.ok(r.success);
  assert.equal(r.data.memberId, undefined);
  assert.equal(r.data.sortOrder, 0);
  const r2 = topicSchema.safeParse({ title: "t", memberId: "3", sortOrder: "5" });
  assert.ok(r2.success && r2.data.memberId === 3 && r2.data.sortOrder === 5);
});

test("postSchema requires positive topicId and non-empty body", () => {
  assert.ok(!postSchema.safeParse({ topicId: "0", title: "t", body: "b" }).success);
  assert.ok(!postSchema.safeParse({ topicId: "1", title: "t", body: "" }).success);
  assert.ok(postSchema.safeParse({ topicId: "1", title: "t", body: "b", heroImage: "", excerpt: "" }).success);
});
