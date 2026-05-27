// src/lib/mbtiCasting/nameGenLink.ts
// 캐스팅 결과 → 밴드 이름 생성기 초기값 매핑.
// 생성기 씬/무드 enum 으로 best-effort 변환해 쿼리스트링을 만든다.

import type { GenreId } from "./types";
import type { Mood, Scene } from "../bandName/types";

export const GENRE_TO_SCENE: Record<GenreId, Scene> = {
  jPop: "jrock",
  jRock: "jrock",
  popPunk: "punk",
  alternative: "emo",
  indieRock: "hongdae",
  cityPop: "citypop",
  metalHeavyRock: "metal",
};

// MBTI moodTags(자유 한글) → 생성기 6-enum. 매핑 없는 태그는 무시한다.
export const MOOD_TAG_TO_MOOD: Record<string, Mood> = {
  청량: "fresh", 청춘: "fresh", 질주: "fresh", 반짝임: "fresh", 스피드: "fresh",
  여름: "fresh", 컬러풀: "fresh", 속도감: "fresh", 직진: "fresh", 떼창: "fresh",
  몽환: "dreamy", 공간감: "dreamy", 새벽: "dreamy", 야경: "dreamy", 네온: "dreamy",
  미래적: "dreamy", 실험적: "dreamy", 호기심: "dreamy", 변칙: "dreamy",
  여운: "wistful", 서사: "wistful", 감성: "wistful", 나른함: "wistful",
  잔상: "wistful", 산책: "wistful",
  폭발: "rough", 강렬: "rough", 반항: "rough", 하이게인: "rough", 중량감: "rough",
  파워: "rough", 카리스마: "rough", 도발: "rough",
  낭만: "romantic", 따뜻함: "romantic", 온기: "romantic", 멜로디: "romantic",
  재치: "funny", 즐거움: "funny",
};

export function buildNameGenQuery(genre: GenreId, moodTags: string[]): string {
  const params = new URLSearchParams({ scene: GENRE_TO_SCENE[genre] });
  for (const tag of moodTags) {
    const mood = MOOD_TAG_TO_MOOD[tag];
    if (mood) {
      params.set("mood", mood);
      break;
    }
  }
  return params.toString();
}
