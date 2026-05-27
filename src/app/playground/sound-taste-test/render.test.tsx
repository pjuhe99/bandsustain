// 결과/문항 화면이 실제로 런타임 에러 없이 렌더되는지 정적 렌더 스모크.
// (HTTP 스모크는 intro 만 보고, 결과 화면은 클릭 후 클라이언트에서만 그려지므로
//  "테스트 완료 후 흰 화면" 류 회귀를 잡기 위한 가드.)
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QUESTIONS } from "@/lib/soundTaste/data";
import { calculateUserProfile, createTestResult } from "@/lib/soundTaste/engine";
import { Question, Result } from "./SoundTasteTest";

function profileForSuffix(suffix: string) {
  return calculateUserProfile(
    QUESTIONS.map((q) => q.options.find((o) => o.id.endsWith(suffix))!.vector),
  );
}

test("Result 화면이 모든 대표 프로필에서 에러 없이 렌더된다", () => {
  for (const suffix of ["_a", "_b", "_c", "_d"]) {
    const result = createTestResult(profileForSuffix(suffix));
    const html = renderToStaticMarkup(
      <Result result={result} onRestart={() => {}} />,
    );
    assert.ok(html.includes(result.mainGenre.resultTitle), `${suffix} 결과 타입명 누락`);
    assert.ok(html.includes(result.mainGenre.name), `${suffix} 메인 장르명 누락`);
    assert.ok(html.includes(result.recommendedTracks[0].artist), `${suffix} 추천곡 누락`);
    assert.ok(html.includes(result.distantGenre.name), `${suffix} 거리 장르 누락`);
    assert.ok(html.includes("다시 테스트하기"), `${suffix} 다시하기 버튼 누락`);
    // gradient 클래스가 className 에 실제로 박히는지 (CSS 생성과 별개로 마크업 확인)
    assert.ok(
      html.includes(result.mainGenre.visual.gradient),
      `${suffix} gradient 클래스 누락`,
    );
    // YouTube 들어보기 링크
    assert.ok(html.includes("youtube.com/results"), `${suffix} 들어보기 링크 누락`);
  }
});

test("Question 화면이 에러 없이 렌더되고 진행률/선택지를 표시한다", () => {
  const q = QUESTIONS[2];
  const html = renderToStaticMarkup(
    <Question
      index={2}
      selectedOptionId={null}
      pendingOptionId={null}
      onSelect={() => {}}
      onBack={() => {}}
    />,
  );
  assert.ok(html.includes(q.prompt), "질문 문구 누락");
  for (const o of q.options) {
    assert.ok(html.includes(o.label), `선택지 누락: ${o.label}`);
  }
  assert.ok(html.includes("3 / 16") || html.includes("3 /"), "진행률 표기 누락");
});
