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
    slug: "kim-yeongmin-bot",
    title: "김영민 봇",
    description: "궁금한 게 있으면 김영민 봇이 답해드려요.",
    cta: "말 걸러 가기",
    eyebrow: "이야기 상대",
    href: "/playground/kim-yeongmin-bot",
  },
  {
    slug: "pedalboard-planner",
    title: "페달보드 플래너",
    description: "원하는 보드를 고르고 페달을 배치해 나만의 페달보드를 공유해보세요.",
    cta: "보드 만들러 가기",
    eyebrow: "이상한 도구",
    href: "/playground/pedalboard-planner",
  },
  {
    slug: "band-name-generator",
    title: "밴드 이름 생성기",
    description: "몇 가지 취향을 고르면 나만의 인디밴드 이름을 만들어드려요.",
    cta: "이름 만들러 가기",
    eyebrow: "이상한 도구",
    href: "/playground/band-name-generator",
  },
  {
    slug: "sound-taste-test",
    title: "사운드 취향 테스트",
    description: "16개의 장면과 소리를 고르면, 당신과 닮은 밴드 음악과 추천곡을 찾아드려요.",
    cta: "테스트 하러 가기",
    eyebrow: "취향 실험",
    href: "/playground/sound-taste-test",
  },
];
