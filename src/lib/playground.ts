export type PlaygroundFeature = {
  slug: string;
  title: string;
  description: string;
  cta: string;
  href?: string;
  eyebrow?: string;
};

export const playgroundFeatures: PlaygroundFeature[] = [
  {
    slug: "band-name-generator",
    title: "밴드 이름 생성기",
    description: "몇 가지 취향을 고르면 나만의 인디밴드 이름을 만들어드려요.",
    cta: "이름 만들러 가기",
    eyebrow: "이상한 도구",
  },
  {
    slug: "song-taste-test",
    title: "서스테인 노래 취향 테스트",
    description: "다섯 가지 질문에 답하면 어울리는 서스테인 트랙을 골라드려요.",
    cta: "테스트 시작",
    eyebrow: "취향 진단",
  },
  {
    slug: "daily-lyric-card",
    title: "오늘의 가사 카드",
    description: "서스테인 가사 한 줄을 카드로 받아보세요. 매일 바뀝니다.",
    cta: "오늘 카드 받기",
    eyebrow: "매일 변하는",
  },
  {
    slug: "random-mood-line",
    title: "랜덤 감성 문장",
    description: "버튼을 누르면 의미 있는 듯 없는 듯한 문장이 튀어나옵니다.",
    cta: "한 줄 뽑기",
    eyebrow: "랜덤 생성",
  },
];
