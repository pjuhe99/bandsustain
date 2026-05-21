import assert from "node:assert/strict";
import test from "node:test";

import { assemblePrompt, type PromptSettings } from "./yeongminPrompt";

function baseSettings(corpusJson: string | null): PromptSettings {
  return {
    sectionIdentity: null,
    sectionRole: null,
    sectionTone: null,
    sectionPersonality: null,
    sectionKnowledge: null,
    sectionLikes: null,
    sectionDislikes: null,
    sectionForbidden: null,
    sectionUnknownHandling: null,
    sectionExamples: null,
    voiceCorpusJson: corpusJson,
  };
}

test("assemblePrompt does not leak corpus metadata labels (notes/category/Corpus/user:/assistant:)", () => {
  const corpus = JSON.stringify([
    {
      category: "기타 잡담",
      user: "오늘 합주 어땠어",
      assistant: "그냥저냥. 베이스가 또 늦었음",
      notes: ["짧게", "투덜대는 톤"],
    },
    {
      category: "장비 질문",
      user: "스트라토캐스터 추천 좀",
      assistant: "예산이 얼만데. 일단 그거부터 말해라",
      notes: ["반문으로 받기"],
    },
  ]);

  const prompt = assemblePrompt(baseSettings(corpus));

  assert.ok(!prompt.includes("- notes:"), "prompt must not include `- notes:` label");
  assert.ok(!prompt.includes("notes:"), "prompt must not include `notes:` label at all");
  assert.ok(!prompt.includes("category:"), "prompt must not include `category:` label");
  assert.ok(!prompt.includes("- user:"), "prompt must not include `- user:` label");
  assert.ok(!prompt.includes("- assistant:"), "prompt must not include `- assistant:` label");
  assert.ok(!prompt.includes("### Corpus"), "prompt must not include `### Corpus` heading");
  assert.ok(!prompt.includes("기타 잡담"), "prompt must not include category text");
  assert.ok(!prompt.includes("장비 질문"), "prompt must not include category text");
  assert.ok(!prompt.includes("짧게, 투덜대는 톤"), "prompt must not include joined notes content");
  assert.ok(!prompt.includes("반문으로 받기"), "prompt must not include any individual note content");

  assert.ok(prompt.includes("오늘 합주 어땠어"), "prompt should still contain corpus user line as Q text");
  assert.ok(
    prompt.includes("그냥저냥. 베이스가 또 늦었음"),
    "prompt should still contain corpus assistant line as A text",
  );
});

test("assemblePrompt header instructs model to hide internal labels", () => {
  const prompt = assemblePrompt(baseSettings(null));
  assert.ok(prompt.includes("내부 메타데이터"), "header must instruct model to hide internal metadata");
  assert.ok(prompt.includes("notes"), "header must explicitly name `notes` as forbidden to reveal");
  assert.ok(prompt.includes("Voice Corpus"), "header must explicitly name `Voice Corpus` as forbidden to reveal");
});

test("assemblePrompt skips entries missing user or assistant text", () => {
  const corpus = JSON.stringify([
    { category: "x", user: "", assistant: "이건 나오면 안 됨", notes: [] },
    { category: "x", user: "이것도 나오면 안 됨", assistant: "  ", notes: [] },
    { category: "y", user: "정상 질문", assistant: "정상 답변", notes: [] },
  ]);
  const prompt = assemblePrompt(baseSettings(corpus));
  assert.ok(!prompt.includes("이건 나오면 안 됨"), "entry with empty user should be skipped");
  assert.ok(!prompt.includes("이것도 나오면 안 됨"), "entry with empty assistant should be skipped");
  assert.ok(prompt.includes("정상 질문"), "valid entry user text should appear");
  assert.ok(prompt.includes("정상 답변"), "valid entry assistant text should appear");
});

test("assemblePrompt omits voice-corpus section when no entries exist", () => {
  const promptEmpty = assemblePrompt(baseSettings(""));
  assert.ok(!promptEmpty.includes("답변 톤 참고"), "header should not appear when corpus empty");
  const promptInvalid = assemblePrompt(baseSettings("not-json"));
  assert.ok(!promptInvalid.includes("답변 톤 참고"), "header should not appear when corpus invalid JSON");
});
