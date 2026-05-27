// 밴드 이름 생성기 — 선택 UI 메타데이터와 기본값.

import type { BandNameInput, LanguageStyle, Mood, Scene, Weirdness } from "./types";

export const sceneOptions: { value: Scene; label: string; description: string }[] = [
  { value: "jrock", label: "J-ROCK / 애니 엔딩", description: "청춘, 질주, 여름밤, 일본 밴드 같은 느낌" },
  { value: "hongdae", label: "홍대 인디", description: "생활감 있고 묘하게 기억에 남는 이름" },
  { value: "punk", label: "펑크 / 개러지", description: "시끄럽고 거칠고 조금 망가진 느낌" },
  { value: "citypop", label: "시티팝", description: "네온, 드라이브, 바다, 여름밤의 느낌" },
  { value: "emo", label: "이모 / 슈게이즈", description: "몽환적이고 쓸쓸하고 노이즈가 많은 느낌" },
  { value: "campus", label: "대학축제 청춘록", description: "친근하고 같이 따라 부를 수 있는 느낌" },
  { value: "metal", label: "메탈 / 헤비록", description: "철, 화염, 심연, 폭풍처럼 무겁고 강렬한 느낌" },
];

export const moodOptions: { value: Mood; label: string }[] = [
  { value: "fresh", label: "청량한" },
  { value: "dreamy", label: "몽환적인" },
  { value: "wistful", label: "쓸쓸한" },
  { value: "funny", label: "이상한데 괜찮은" },
  { value: "rough", label: "거칠고 시끄러운" },
  { value: "romantic", label: "낭만적인" },
];

export const languageOptions: { value: LanguageStyle; label: string }[] = [
  { value: "korean", label: "한국어" },
  { value: "mixed", label: "한글 + 영어" },
  { value: "english", label: "영어" },
];

export const weirdnessLabels: Record<Weirdness, string> = {
  1: "진짜 있을 법한",
  2: "조금 개성 있는",
  3: "묘하게 기억나는",
  4: "이상한데 괜찮은",
  5: "대체 무슨 밴드야?",
};

export const weirdnessLevels: Weirdness[] = [1, 2, 3, 4, 5];

export const defaultInput: BandNameInput = {
  scene: "jrock",
  mood: "fresh",
  language: "korean",
  weirdness: 3,
};

// 외부(예: MBTI 캐스팅)에서 넘어온 query 로 초기 선택값을 만든다.
// 알려진 값만 통과시키므로 잘못된 파라미터는 무시되어 기본 동작이 유지된다.
export function parseInitialInput(
  sp: Record<string, string | string[] | undefined>,
): Partial<BandNameInput> {
  const out: Partial<BandNameInput> = {};
  const scene = typeof sp.scene === "string" ? sp.scene : undefined;
  if (scene && sceneOptions.some((o) => o.value === scene)) out.scene = scene as Scene;
  const mood = typeof sp.mood === "string" ? sp.mood : undefined;
  if (mood && moodOptions.some((o) => o.value === mood)) out.mood = mood as Mood;
  return out;
}
