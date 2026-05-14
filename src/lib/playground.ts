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
    slug: "kim-youngmin-bot",
    title: "김영민 봇",
    description: "궁금한 게 있으면 김영민 봇이 답해드려요.",
    cta: "말 걸러 가기",
    eyebrow: "이야기 상대",
  },
  {
    slug: "band-name-generator",
    title: "밴드 이름 생성기",
    description: "몇 가지 취향을 고르면 나만의 인디밴드 이름을 만들어드려요.",
    cta: "이름 만들러 가기",
    eyebrow: "이상한 도구",
  },
];
