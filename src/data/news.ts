export type NewsItem = {
  id: string;
  headline: string;
  category: string;
  date: string;
  heroImage: string;
  body: string;
  midImage?: string;
};

export const news: NewsItem[] = [
  {
    id: "01",
    headline: "“중간고사 끝낸 서울대생, 음악 전면 재개 선언”… 김상준, ‘사운드 혁명’ 예고",
    category: "Lifestyle",
    date: "2026-04-24",
    heroImage: "/news/news01-hero.png",
    body: `서울 — 김상준(前 밴드 서스테인 드러머, 서울대학교 경영학과)가 4월 23일 중간고사를 공식 종료하며 음악 활동 전면 복귀를 선언했다. 일상적인 시험 종료로 보일 수 있는 이번 사건이, 음악 커뮤니티에서는 이례적으로 큰 반향을 일으키고 있다.

김상준은 시험 직후 “이제 진짜 시작”이라는 짧은 메시지와 함께 향후 계획을 공개했다. 그는 당분간 집중적으로 기타 연습과 개인 녹음 작업에 몰두할 예정이며, 이를 위해 이펙터 보드 재구성, 앰프 신규 구매, 오디오 인터페이스 세팅 등 전방위적인 장비 업그레이드를 진행 중인 것으로 알려졌다.

특히 이번 선언은 단순한 취미 활동 복귀를 넘어, ‘사운드 퀄리티 중심의 개인 제작 체계 구축’이라는 점에서 주목된다. 관계자에 따르면 김상준은 기존 드러머 포지션에서 벗어나, 기타 중심의 사운드 디자인과 녹음까지 직접 수행하는 ‘1인 프로덕션 체제’로의 전환을 준비 중이다.

음악 업계 일부에서는 이를 두고 “학업과 창작 사이에서 균형을 잡던 개인이, 특정 시점을 기점으로 창작에 전력을 다하는 전형적인 전환 사례”라고 평가했다. 한 익명의 밴드 관계자는 “시험 기간이 끝난 직후 장비 세팅부터 들어간다는 건, 이미 머릿속에 음악 구상이 끝나 있었다는 의미”라고 분석했다.

현재 김상준의 구체적인 작업물 공개 일정은 알려지지 않았지만, 주변에서는 이르면 단기간 내 데모 트랙 혹은 녹음 파일이 공개될 가능성도 제기되고 있다.

중간고사 종료라는 일상의 한 장면이, 한 개인의 음악적 재출발로 이어지는 순간. 김상준의 다음 행보에 이목이 집중되고 있다.`,
  },
  {
    id: "02",
    headline: "“기타 대신 코드 잡았다”… 서스테인 리더 김영민, 1인 개발로 ‘전략 게임 신화’ 쓰다",
    category: "Business",
    date: "2026-04-24",
    heroImage: "/news/news02-hero.png",
    body: `서울 — 밴드 서스테인의 기타리스트이자 보컬, 그리고 리더로 알려진 김영민이 이번에는 전혀 다른 무대에서 이름을 올렸다. 음악이 아닌 게임 개발이다. 그것도 단 한 명의 힘으로 완성한 작품이다.

김영민이 공개한 신작 ‘Age of Medieval(에이지오브비디블)’은 중세 유럽을 배경으로 한 턴제 전략 국가 경영 게임으로, 출시 직후 커뮤니티를 중심으로 빠르게 입소문을 타고 있다.

이 게임은 플레이어가 하나의 국가를 선택해 외교, 전쟁, 경제를 모두 직접 운영하는 구조로 설계되었다. 단순한 병력 운용을 넘어, 동맹 관계의 균형과 자원 배분, 그리고 예측 불가능한 정치적 변수까지 고려해야 하는 깊이 있는 시스템이 특징이다. 특히 턴제 방식 특유의 ‘한 수 앞을 보는 긴장감’이 잘 살아 있다는 평가다.

주목할 점은 이 모든 시스템을 김영민이 혼자 설계하고 구현했다는 사실이다. 별도의 팀 없이 기획, 개발, 밸런싱까지 전 과정을 1인으로 진행했다는 점에서 업계에서도 이례적인 사례로 보고 있다.

한 게임 커뮤니티 이용자는 “처음엔 그냥 취미로 만든 줄 알았는데, 몇 시간 붙잡고 있었다”며 “밴드 하던 사람이 맞나 싶을 정도로 완성도가 높다”고 반응했다.

김영민은 별도의 공식 인터뷰 없이 지인들에게 “재밌어서 만들었다”는 짧은 입장만을 전한 것으로 알려졌다. 하지만 그의 행보는 단순한 취미 수준을 넘어, 창작 영역을 확장하는 새로운 사례로 주목받고 있다.

기타를 내려놓고 키보드를 잡은 한 아티스트. 그리고 그 결과물은 또 하나의 ‘작은 세계’가 되었다.
김영민이 만든 중세는, 생각보다 꽤 치열하다.`,
  },
  {
    id: "03",
    headline: "Behind the scenes: building the mix",
    category: "News",
    date: "2026-04-03",
    heroImage: "",
    body: `Mixing has been slower than we planned, and we are okay with that.

We decided to keep the room tone from the studio takes rather than cleaning it up. It changes the feel of the record in a way we like.

More notes from the process will follow as the release gets closer.`,
  },
];

export function sortedByDateDesc(list: NewsItem[] = news): NewsItem[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date));
}

export function formatNewsDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function excerpt(body: string, max = 140): string {
  const firstParagraph = body.split(/\n\n/)[0]?.trim() ?? "";
  if (firstParagraph.length <= max) return firstParagraph;
  return firstParagraph.slice(0, max).replace(/\s+\S*$/, "") + "…";
}
