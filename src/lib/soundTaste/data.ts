// 사운드 취향 테스트 — 16문항 4지선다로 사용자의 사운드 취향 벡터를 모아
// 가장 잘 맞는 장르/곡과 "거리가 있는" 장르/체험곡을 추천하기 위한 정적 데이터.
// UI 와 분리해 곡/장르 추가가 쉽도록 데이터만 모아둔다.

export type DimensionKey =
  | "energy" // 잔잔함 ↔ 폭발성
  | "brightness" // 서늘함/어두움 ↔ 산뜻함/밝음
  | "distortion" // 깨끗한 소리 ↔ 거친 기타/고강도 사운드
  | "groove" // 감상 중심 ↔ 몸이 반응하는 리듬
  | "atmosphere" // 직선적 선명함 ↔ 몽환적/공간감
  | "complexity" // 직관적 구성 ↔ 변박/전개 변화/실험성
  | "emotion" // 담백함 ↔ 강한 감정 고조
  | "accessibility"; // 낯선 개성 ↔ 따라 부르기 쉬운 친숙함

export type SoundVector = Record<DimensionKey, number>;

export interface QuestionOption {
  id: string;
  label: string;
  emoji?: string;
  vector: SoundVector;
}

export interface Question {
  id: string;
  prompt: string;
  options: QuestionOption[];
}

export interface Genre {
  id: string;
  name: string;
  resultTitle: string;
  description: string;
  vector: SoundVector;
  fallbackTags: string[];
  preferredTagOrder: string[];
  visual: {
    gradient: string;
    icon: string;
  };
}

export interface Track {
  id: string;
  artist: string;
  title: string;
  genreIds: string[];
  vector: SoundVector;
  reason: string;
  searchQuery: string;
}

export interface ProfileTagRule {
  key: string;
  test: (v: SoundVector) => boolean;
  label: string;
}

export const DIMENSIONS: DimensionKey[] = [
  "energy",
  "brightness",
  "distortion",
  "groove",
  "atmosphere",
  "complexity",
  "emotion",
  "accessibility",
];

export const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  energy: 1.15,
  brightness: 0.9,
  distortion: 1.1,
  groove: 0.9,
  atmosphere: 1.05,
  complexity: 0.95,
  emotion: 1.05,
  accessibility: 0.9,
};

export const PROFILE_TAG_RULES: ProfileTagRule[] = [
  { key: "high-energy", test: (v) => v.energy >= 3.8, label: "폭발하는 에너지" },
  { key: "low-energy", test: (v) => v.energy <= 2.2, label: "차분한 몰입" },
  { key: "high-brightness", test: (v) => v.brightness >= 3.7, label: "밝은 청춘감" },
  { key: "low-brightness", test: (v) => v.brightness <= 2.1, label: "서늘한 정서" },
  { key: "high-distortion", test: (v) => v.distortion >= 3.8, label: "거친 기타 톤" },
  { key: "high-groove", test: (v) => v.groove >= 3.7, label: "리듬을 타는 귀" },
  { key: "high-atmosphere", test: (v) => v.atmosphere >= 3.7, label: "번지는 공간감" },
  { key: "high-complexity", test: (v) => v.complexity >= 3.5, label: "예측 불가 전개" },
  { key: "high-emotion", test: (v) => v.emotion >= 3.8, label: "감정의 폭발" },
  { key: "high-accessibility", test: (v) => v.accessibility >= 3.8, label: "선명한 후렴" },
];

export const QUESTIONS: Question[] = [
  {
    id: "q01",
    prompt: "밤에 혼자 걷다가 이어폰을 낀다면, 가장 어울리는 장면은?",
    options: [
      { id: "q01_a", emoji: "🌙", label: "가로등 아래 조용히 이어지는 골목", vector: { energy: 1, brightness: 2, distortion: 1, groove: 1, atmosphere: 4, complexity: 2, emotion: 3, accessibility: 2 } },
      { id: "q01_b", emoji: "🌃", label: "네온사인이 반짝이는 번화가", vector: { energy: 3, brightness: 4, distortion: 1, groove: 5, atmosphere: 3, complexity: 2, emotion: 2, accessibility: 4 } },
      { id: "q01_c", emoji: "🌉", label: "바람이 세게 부는 텅 빈 다리 위", vector: { energy: 4, brightness: 1, distortion: 4, groove: 2, atmosphere: 3, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q01_d", emoji: "🎪", label: "친구들과 뛰어가는 공연장 앞", vector: { energy: 5, brightness: 5, distortion: 3, groove: 4, atmosphere: 1, complexity: 1, emotion: 4, accessibility: 5 } },
    ],
  },
  {
    id: "q02",
    prompt: "노래를 듣다가 가장 짜릿한 순간은?",
    options: [
      { id: "q02_a", emoji: "🎙️", label: "첫 소절의 목소리가 마음에 꽂힐 때", vector: { energy: 2, brightness: 2, distortion: 1, groove: 1, atmosphere: 3, complexity: 2, emotion: 5, accessibility: 3 } },
      { id: "q02_b", emoji: "✨", label: "후렴에서 멜로디가 확 터질 때", vector: { energy: 4, brightness: 5, distortion: 2, groove: 3, atmosphere: 1, complexity: 1, emotion: 4, accessibility: 5 } },
      { id: "q02_c", emoji: "🎸", label: "기타 소리가 벽처럼 몰아칠 때", vector: { energy: 5, brightness: 1, distortion: 5, groove: 3, atmosphere: 3, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q02_d", emoji: "🧩", label: "예상 못 한 전개로 곡의 표정이 달라질 때", vector: { energy: 3, brightness: 2, distortion: 3, groove: 3, atmosphere: 3, complexity: 5, emotion: 3, accessibility: 1 } },
    ],
  },
  {
    id: "q03",
    prompt: "영화의 엔딩 크레딧에 깔렸으면 하는 음악은?",
    options: [
      { id: "q03_a", emoji: "🎞️", label: "마음이 먹먹하게 남는 잔잔한 곡", vector: { energy: 1, brightness: 2, distortion: 1, groove: 1, atmosphere: 4, complexity: 2, emotion: 4, accessibility: 3 } },
      { id: "q03_b", emoji: "🚲", label: "새 출발처럼 가볍고 밝은 곡", vector: { energy: 3, brightness: 5, distortion: 1, groove: 3, atmosphere: 1, complexity: 1, emotion: 3, accessibility: 5 } },
      { id: "q03_c", emoji: "🔥", label: "모든 감정을 쏟아내는 폭발적인 곡", vector: { energy: 5, brightness: 1, distortion: 5, groove: 3, atmosphere: 2, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q03_d", emoji: "🪐", label: "결말의 의미를 계속 곱씹게 되는 낯선 곡", vector: { energy: 2, brightness: 1, distortion: 2, groove: 1, atmosphere: 5, complexity: 5, emotion: 3, accessibility: 1 } },
    ],
  },
  {
    id: "q04",
    prompt: "공연장에서 가장 보고 싶은 순간은?",
    options: [
      { id: "q04_a", emoji: "🙌", label: "관객들이 후렴을 한목소리로 따라 부르는 순간", vector: { energy: 4, brightness: 5, distortion: 2, groove: 4, atmosphere: 1, complexity: 1, emotion: 4, accessibility: 5 } },
      { id: "q04_b", emoji: "💧", label: "보컬이 울먹이듯 한 문장을 오래 붙드는 순간", vector: { energy: 2, brightness: 1, distortion: 1, groove: 1, atmosphere: 4, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q04_c", emoji: "⚡", label: "기타와 드럼이 한꺼번에 밀려오는 순간", vector: { energy: 5, brightness: 1, distortion: 5, groove: 4, atmosphere: 2, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q04_d", emoji: "🥁", label: "연주자들이 복잡한 합주를 정확히 맞추는 순간", vector: { energy: 3, brightness: 2, distortion: 3, groove: 4, atmosphere: 2, complexity: 5, emotion: 2, accessibility: 1 } },
    ],
  },
  {
    id: "q05",
    prompt: "유난히 지친 날, 음악이 해줬으면 하는 역할은?",
    options: [
      { id: "q05_a", emoji: "🛋️", label: "마음을 조용히 가라앉혀 주기", vector: { energy: 1, brightness: 2, distortion: 1, groove: 1, atmosphere: 4, complexity: 1, emotion: 3, accessibility: 3 } },
      { id: "q05_b", emoji: "🍋", label: "기분을 산뜻하게 환기해 주기", vector: { energy: 3, brightness: 5, distortion: 1, groove: 4, atmosphere: 1, complexity: 1, emotion: 2, accessibility: 5 } },
      { id: "q05_c", emoji: "📢", label: "답답한 감정을 대신 소리쳐 주기", vector: { energy: 5, brightness: 1, distortion: 5, groove: 3, atmosphere: 1, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q05_d", emoji: "🌀", label: "머릿속이 비워질 만큼 깊이 몰입시키기", vector: { energy: 2, brightness: 1, distortion: 3, groove: 2, atmosphere: 5, complexity: 4, emotion: 3, accessibility: 1 } },
    ],
  },
  {
    id: "q06",
    prompt: "지금 하나의 색 조합으로 방을 꾸민다면?",
    options: [
      { id: "q06_a", emoji: "🩵", label: "하늘색과 흰색, 맑고 여백 있게", vector: { energy: 2, brightness: 5, distortion: 1, groove: 2, atmosphere: 3, complexity: 1, emotion: 2, accessibility: 4 } },
      { id: "q06_b", emoji: "🧡", label: "주황색과 초록색, 빈티지하고 경쾌하게", vector: { energy: 3, brightness: 4, distortion: 1, groove: 5, atmosphere: 2, complexity: 2, emotion: 2, accessibility: 4 } },
      { id: "q06_c", emoji: "🖤", label: "검정색과 빨간색, 선명하고 강렬하게", vector: { energy: 5, brightness: 1, distortion: 5, groove: 3, atmosphere: 1, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q06_d", emoji: "💜", label: "보라색과 남색, 흐릿하고 깊게", vector: { energy: 1, brightness: 1, distortion: 2, groove: 1, atmosphere: 5, complexity: 3, emotion: 4, accessibility: 1 } },
    ],
  },
  {
    id: "q07",
    prompt: "노랫말이 어떤 방식으로 다가올 때 더 끌리나요?",
    options: [
      { id: "q07_a", emoji: "☕", label: "사소한 일상을 정확하게 짚어줄 때", vector: { energy: 2, brightness: 3, distortion: 1, groove: 1, atmosphere: 2, complexity: 1, emotion: 4, accessibility: 4 } },
      { id: "q07_b", emoji: "🏃", label: "청춘과 사랑을 반짝이게 그려낼 때", vector: { energy: 4, brightness: 5, distortion: 2, groove: 3, atmosphere: 1, complexity: 1, emotion: 4, accessibility: 5 } },
      { id: "q07_c", emoji: "🩹", label: "상처나 분노를 숨기지 않고 터뜨릴 때", vector: { energy: 5, brightness: 1, distortion: 4, groove: 2, atmosphere: 2, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q07_d", emoji: "🌫️", label: "뜻을 다 몰라도 이미지가 오래 남을 때", vector: { energy: 1, brightness: 2, distortion: 2, groove: 1, atmosphere: 5, complexity: 4, emotion: 3, accessibility: 1 } },
    ],
  },
  {
    id: "q08",
    prompt: "가장 자연스럽게 손이 가는 옷의 분위기는?",
    options: [
      { id: "q08_a", emoji: "👕", label: "담백한 셔츠와 데님", vector: { energy: 2, brightness: 3, distortion: 1, groove: 1, atmosphere: 2, complexity: 1, emotion: 2, accessibility: 4 } },
      { id: "q08_b", emoji: "🧢", label: "색감이 있는 빈티지 캐주얼", vector: { energy: 3, brightness: 4, distortion: 1, groove: 5, atmosphere: 2, complexity: 2, emotion: 2, accessibility: 4 } },
      { id: "q08_c", emoji: "⛓️", label: "검은 티셔츠와 거친 액세서리", vector: { energy: 5, brightness: 1, distortion: 5, groove: 3, atmosphere: 1, complexity: 2, emotion: 4, accessibility: 2 } },
      { id: "q08_d", emoji: "🧥", label: "레이어가 많고 실루엣이 독특한 스타일", vector: { energy: 2, brightness: 2, distortion: 2, groove: 2, atmosphere: 4, complexity: 5, emotion: 3, accessibility: 1 } },
    ],
  },
  {
    id: "q09",
    prompt: "드럼 소리를 들었을 때 더 마음이 움직이는 것은?",
    options: [
      { id: "q09_a", emoji: "🫧", label: "조용히 뒤를 받쳐주는 편안한 리듬", vector: { energy: 1, brightness: 3, distortion: 1, groove: 2, atmosphere: 3, complexity: 1, emotion: 2, accessibility: 4 } },
      { id: "q09_b", emoji: "🕺", label: "몸을 살짝 흔들게 되는 탄력 있는 리듬", vector: { energy: 3, brightness: 4, distortion: 1, groove: 5, atmosphere: 2, complexity: 2, emotion: 2, accessibility: 4 } },
      { id: "q09_c", emoji: "🥊", label: "심장처럼 쿵쿵 몰아붙이는 리듬", vector: { energy: 5, brightness: 1, distortion: 5, groove: 4, atmosphere: 1, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q09_d", emoji: "🔢", label: "박자를 놓칠 듯 말 듯 비트가 꼬이는 리듬", vector: { energy: 3, brightness: 2, distortion: 2, groove: 4, atmosphere: 2, complexity: 5, emotion: 2, accessibility: 1 } },
    ],
  },
  {
    id: "q10",
    prompt: "기타가 등장한다면 어떤 질감이 가장 좋나요?",
    options: [
      { id: "q10_a", emoji: "💎", label: "맑고 반짝이는 소리", vector: { energy: 2, brightness: 5, distortion: 0, groove: 2, atmosphere: 3, complexity: 1, emotion: 2, accessibility: 4 } },
      { id: "q10_b", emoji: "🛹", label: "경쾌하게 앞을 향해 달리는 소리", vector: { energy: 5, brightness: 4, distortion: 3, groove: 4, atmosphere: 1, complexity: 1, emotion: 3, accessibility: 5 } },
      { id: "q10_c", emoji: "🧨", label: "거칠고 크게 찢어지는 소리", vector: { energy: 5, brightness: 1, distortion: 5, groove: 3, atmosphere: 2, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q10_d", emoji: "🌁", label: "안개처럼 겹겹이 번지는 소리", vector: { energy: 2, brightness: 1, distortion: 3, groove: 1, atmosphere: 5, complexity: 3, emotion: 4, accessibility: 1 } },
    ],
  },
  {
    id: "q11",
    prompt: "좋아하는 이야기의 결말은 어떤 모습에 가까운가요?",
    options: [
      { id: "q11_a", emoji: "📖", label: "크게 말하지 않아도 여운이 남는 결말", vector: { energy: 1, brightness: 2, distortion: 1, groove: 1, atmosphere: 4, complexity: 2, emotion: 4, accessibility: 3 } },
      { id: "q11_b", emoji: "🌈", label: "기분 좋게 웃으며 걸어나가는 결말", vector: { energy: 3, brightness: 5, distortion: 1, groove: 3, atmosphere: 1, complexity: 1, emotion: 3, accessibility: 5 } },
      { id: "q11_c", emoji: "💥", label: "모든 갈등이 한순간에 폭발하는 결말", vector: { energy: 5, brightness: 1, distortion: 5, groove: 3, atmosphere: 1, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q11_d", emoji: "❔", label: "해석이 열려 있어 오래 토론하게 되는 결말", vector: { energy: 2, brightness: 1, distortion: 2, groove: 1, atmosphere: 4, complexity: 5, emotion: 3, accessibility: 1 } },
    ],
  },
  {
    id: "q12",
    prompt: "새로운 노래를 재생했을 때 가장 먼저 귀가 가는 곳은?",
    options: [
      { id: "q12_a", emoji: "🗣️", label: "보컬의 목소리와 말투", vector: { energy: 2, brightness: 2, distortion: 1, groove: 1, atmosphere: 3, complexity: 1, emotion: 5, accessibility: 3 } },
      { id: "q12_b", emoji: "🎶", label: "한 번에 기억되는 후렴구", vector: { energy: 4, brightness: 5, distortion: 2, groove: 3, atmosphere: 1, complexity: 1, emotion: 3, accessibility: 5 } },
      { id: "q12_c", emoji: "🔊", label: "기타와 드럼이 만드는 힘", vector: { energy: 5, brightness: 1, distortion: 5, groove: 4, atmosphere: 1, complexity: 2, emotion: 4, accessibility: 2 } },
      { id: "q12_d", emoji: "🔮", label: "곡 전체에 깔린 독특한 공기", vector: { energy: 2, brightness: 2, distortion: 2, groove: 2, atmosphere: 5, complexity: 4, emotion: 3, accessibility: 1 } },
    ],
  },
  {
    id: "q13",
    prompt: "비 오는 날, 이어폰에서 흘러나왔으면 하는 음악은?",
    options: [
      { id: "q13_a", emoji: "🪟", label: "창문을 바라보며 조용히 듣는 음악", vector: { energy: 1, brightness: 2, distortion: 1, groove: 1, atmosphere: 4, complexity: 2, emotion: 4, accessibility: 3 } },
      { id: "q13_b", emoji: "☂️", label: "우산을 쓰고 가볍게 걸어가게 되는 음악", vector: { energy: 3, brightness: 4, distortion: 1, groove: 4, atmosphere: 2, complexity: 1, emotion: 2, accessibility: 5 } },
      { id: "q13_c", emoji: "⛈️", label: "빗소리보다 더 크게 몰아치는 음악", vector: { energy: 5, brightness: 1, distortion: 5, groove: 3, atmosphere: 2, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q13_d", emoji: "🌌", label: "도시가 흐릿하게 번지는 것 같은 음악", vector: { energy: 2, brightness: 1, distortion: 3, groove: 1, atmosphere: 5, complexity: 3, emotion: 4, accessibility: 1 } },
    ],
  },
  {
    id: "q14",
    prompt: "30초짜리 영상에 음악을 붙인다면?",
    options: [
      { id: "q14_a", emoji: "📷", label: "담백한 기타와 목소리로 장면을 살린다", vector: { energy: 1, brightness: 3, distortion: 0, groove: 1, atmosphere: 3, complexity: 1, emotion: 4, accessibility: 4 } },
      { id: "q14_b", emoji: "🎬", label: "바로 따라 부를 수 있는 밝은 밴드곡을 넣는다", vector: { energy: 4, brightness: 5, distortion: 2, groove: 3, atmosphere: 1, complexity: 1, emotion: 3, accessibility: 5 } },
      { id: "q14_c", emoji: "🚨", label: "시작부터 강하게 치고 들어오는 록을 넣는다", vector: { energy: 5, brightness: 1, distortion: 5, groove: 4, atmosphere: 1, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q14_d", emoji: "🧪", label: "한 번 들어도 정체가 궁금한 곡을 넣는다", vector: { energy: 2, brightness: 2, distortion: 2, groove: 2, atmosphere: 4, complexity: 5, emotion: 2, accessibility: 1 } },
    ],
  },
  {
    id: "q15",
    prompt: "친구가 “이 곡 진짜 특이해”라며 이어폰을 건네면?",
    options: [
      { id: "q15_a", emoji: "🙂", label: "너무 어렵지만 않다면 끝까지 들어본다", vector: { energy: 2, brightness: 3, distortion: 1, groove: 2, atmosphere: 3, complexity: 2, emotion: 3, accessibility: 4 } },
      { id: "q15_b", emoji: "💾", label: "후렴이 좋으면 곧바로 저장한다", vector: { energy: 4, brightness: 5, distortion: 2, groove: 3, atmosphere: 1, complexity: 1, emotion: 3, accessibility: 5 } },
      { id: "q15_c", emoji: "🤘", label: "강렬하다는 말이라면 오히려 기대된다", vector: { energy: 5, brightness: 1, distortion: 5, groove: 3, atmosphere: 1, complexity: 2, emotion: 5, accessibility: 2 } },
      { id: "q15_d", emoji: "🧭", label: "낯설다는 말만으로도 벌써 궁금하다", vector: { energy: 2, brightness: 2, distortion: 3, groove: 2, atmosphere: 4, complexity: 5, emotion: 3, accessibility: 0 } },
    ],
  },
  {
    id: "q16",
    prompt: "밴드를 직접 만든다면, 가장 해보고 싶은 무대는?",
    options: [
      { id: "q16_a", emoji: "🕯️", label: "작은 라이브바에서 가까이 호흡하는 무대", vector: { energy: 2, brightness: 3, distortion: 1, groove: 1, atmosphere: 3, complexity: 1, emotion: 4, accessibility: 3 } },
      { id: "q16_b", emoji: "🎉", label: "축제에서 모두가 뛰며 따라 부르는 무대", vector: { energy: 5, brightness: 5, distortion: 3, groove: 4, atmosphere: 1, complexity: 1, emotion: 4, accessibility: 5 } },
      { id: "q16_c", emoji: "🌋", label: "조명 아래 무거운 사운드로 압도하는 무대", vector: { energy: 5, brightness: 1, distortion: 5, groove: 3, atmosphere: 2, complexity: 3, emotion: 5, accessibility: 1 } },
      { id: "q16_d", emoji: "🛸", label: "관객들이 “이런 음악 처음이야”라고 말하는 무대", vector: { energy: 3, brightness: 2, distortion: 3, groove: 2, atmosphere: 4, complexity: 5, emotion: 3, accessibility: 0 } },
    ],
  },
];

export const GENRES: Genre[] = [
  {
    id: "jpop-band",
    name: "J-POP 밴드 / 팝록",
    resultTitle: "햇빛 아래 달리는 청춘 밴드",
    description: "선명한 멜로디와 반짝이는 후렴, 함께 부를 수 있는 에너지에 자연스럽게 마음이 움직이는 타입입니다.",
    vector: { energy: 3.7, brightness: 4.8, distortion: 1.7, groove: 3.0, atmosphere: 1.7, complexity: 1.4, emotion: 3.2, accessibility: 4.8 },
    fallbackTags: ["밝은 청춘감", "선명한 후렴", "가벼운 질주감"],
    preferredTagOrder: ["밝은 청춘감", "선명한 후렴", "폭발하는 에너지", "리듬을 타는 귀"],
    visual: { gradient: "from-sky-300 to-yellow-200", icon: "☀️" },
  },
  {
    id: "anime-jrock",
    name: "J-ROCK / 애니록",
    resultTitle: "엔딩 장면을 사랑하는 록 주인공",
    description: "감정이 차오르다가 큰 후렴에서 터지는 전개, 달리듯 치고 나가는 기타 사운드에 강하게 끌립니다.",
    vector: { energy: 4.4, brightness: 3.7, distortion: 3.1, groove: 3.2, atmosphere: 1.8, complexity: 2.0, emotion: 4.4, accessibility: 4.2 },
    fallbackTags: ["감정의 폭발", "달리는 기타", "선명한 후렴"],
    preferredTagOrder: ["감정의 폭발", "폭발하는 에너지", "선명한 후렴", "거친 기타 톤"],
    visual: { gradient: "from-orange-400 to-rose-400", icon: "🏃" },
  },
  {
    id: "pop-punk",
    name: "팝펑크 / 멜로딕 펑크",
    resultTitle: "넘어져도 다시 뛰는 팝펑크 키드",
    description: "빠른 드럼과 시원한 기타, 생각보다 몸이 먼저 반응하는 직진형 밴드 사운드를 좋아합니다.",
    vector: { energy: 4.8, brightness: 4.0, distortion: 3.3, groove: 4.0, atmosphere: 1.0, complexity: 1.4, emotion: 3.8, accessibility: 4.3 },
    fallbackTags: ["폭발하는 에너지", "질주하는 리듬", "떼창 후렴"],
    preferredTagOrder: ["폭발하는 에너지", "밝은 청춘감", "선명한 후렴", "리듬을 타는 귀"],
    visual: { gradient: "from-lime-300 to-blue-400", icon: "🛹" },
  },
  {
    id: "alternative-rock",
    name: "얼터너티브 록",
    resultTitle: "마음속 잡음을 기타로 쏟아내는 사람",
    description: "매끈한 정답보다 거친 질감과 진짜 감정이 남는 소리에서 더 큰 진심을 느끼는 타입입니다.",
    vector: { energy: 4.0, brightness: 1.8, distortion: 4.0, groove: 2.7, atmosphere: 2.4, complexity: 2.7, emotion: 4.3, accessibility: 2.3 },
    fallbackTags: ["거친 기타 톤", "서늘한 정서", "감정의 폭발"],
    preferredTagOrder: ["거친 기타 톤", "감정의 폭발", "서늘한 정서", "예측 불가 전개"],
    visual: { gradient: "from-zinc-600 to-red-500", icon: "📻" },
  },
  {
    id: "shoegaze-dreampop",
    name: "슈게이즈 / 드림팝",
    resultTitle: "안개처럼 번지는 기타를 좋아하는 사람",
    description: "또렷하게 설명되는 감정보다, 겹겹이 번지는 소리와 오래 남는 여운에 머무는 타입입니다.",
    vector: { energy: 2.0, brightness: 1.9, distortion: 2.8, groove: 1.5, atmosphere: 4.9, complexity: 2.8, emotion: 3.8, accessibility: 1.8 },
    fallbackTags: ["번지는 공간감", "차분한 몰입", "서늘한 정서"],
    preferredTagOrder: ["번지는 공간감", "차분한 몰입", "서늘한 정서", "감정의 폭발"],
    visual: { gradient: "from-indigo-300 to-fuchsia-200", icon: "🌫️" },
  },
  {
    id: "citypop-funkpop",
    name: "시티팝 / 펑크팝",
    resultTitle: "네온사인 아래 리듬을 타는 사람",
    description: "소리의 무게보다 매끈한 그루브와 도시적인 반짝임, 기분 좋은 움직임에 더 끌립니다.",
    vector: { energy: 3.2, brightness: 3.9, distortion: 0.9, groove: 4.8, atmosphere: 2.2, complexity: 2.2, emotion: 2.0, accessibility: 3.8 },
    fallbackTags: ["리듬을 타는 귀", "도시의 반짝임", "가벼운 여유"],
    preferredTagOrder: ["리듬을 타는 귀", "밝은 청춘감", "선명한 후렴", "번지는 공간감"],
    visual: { gradient: "from-pink-300 to-cyan-300", icon: "🌃" },
  },
  {
    id: "math-progressive",
    name: "매스록 / 프로그레시브 록",
    resultTitle: "박자를 해체해 듣는 합주 탐험가",
    description: "쉽게 예상되는 후렴보다, 반복해서 들을수록 구조와 연주가 새롭게 보이는 곡에 빠져듭니다.",
    vector: { energy: 3.1, brightness: 2.2, distortion: 2.6, groove: 3.6, atmosphere: 2.8, complexity: 4.9, emotion: 2.6, accessibility: 1.1 },
    fallbackTags: ["예측 불가 전개", "합주의 쾌감", "낯선 매력"],
    preferredTagOrder: ["예측 불가 전개", "리듬을 타는 귀", "번지는 공간감", "거친 기타 톤"],
    visual: { gradient: "from-emerald-300 to-slate-400", icon: "🧩" },
  },
  {
    id: "metalcore",
    name: "메탈 / 메탈코어",
    resultTitle: "소리의 벽 앞에서 살아나는 사람",
    description: "음악이 배경처럼 흐르는 것보다, 무거운 리프와 폭발적인 에너지가 온몸으로 밀려오길 원하는 타입입니다.",
    vector: { energy: 5.0, brightness: 0.8, distortion: 5.0, groove: 3.5, atmosphere: 1.8, complexity: 3.0, emotion: 4.8, accessibility: 1.1 },
    fallbackTags: ["거친 기타 톤", "폭발하는 에너지", "감정의 폭발"],
    preferredTagOrder: ["거친 기타 톤", "폭발하는 에너지", "감정의 폭발", "예측 불가 전개"],
    visual: { gradient: "from-neutral-900 to-red-700", icon: "🔥" },
  },
];

export const TRACKS: Track[] = [
  // J-POP 밴드 / 팝록
  { id: "mrs-green-apple-ao-to-natsu", artist: "Mrs. GREEN APPLE", title: "青と夏", genreIds: ["jpop-band", "anime-jrock"], vector: { energy: 4.1, brightness: 5.0, distortion: 1.8, groove: 3.2, atmosphere: 1.3, complexity: 1.2, emotion: 3.6, accessibility: 5.0 }, reason: "반짝이는 멜로디와 크게 열리는 후렴이 밝은 취향과 잘 맞아요.", searchQuery: "Mrs. GREEN APPLE 青と夏 official" },
  { id: "sumika-lovers", artist: "sumika", title: "Lovers", genreIds: ["jpop-band"], vector: { energy: 3.5, brightness: 4.8, distortion: 1.2, groove: 3.6, atmosphere: 1.4, complexity: 1.4, emotion: 3.0, accessibility: 4.8 }, reason: "가볍게 움직이는 리듬과 친근한 멜로디가 편하게 스며들어요.", searchQuery: "sumika Lovers official" },
  { id: "shishamo-ashita-mo", artist: "SHISHAMO", title: "明日も", genreIds: ["jpop-band", "pop-punk"], vector: { energy: 4.0, brightness: 4.6, distortion: 2.0, groove: 3.2, atmosphere: 1.1, complexity: 1.0, emotion: 3.7, accessibility: 4.7 }, reason: "일상적인 감정과 힘 있는 밴드 후렴을 함께 좋아한다면 잘 맞아요.", searchQuery: "SHISHAMO 明日も official" },
  { id: "official-hige-dandism-shukumei", artist: "Official髭男dism", title: "宿命", genreIds: ["jpop-band"], vector: { energy: 4.0, brightness: 4.3, distortion: 1.4, groove: 3.2, atmosphere: 1.3, complexity: 2.0, emotion: 4.2, accessibility: 4.8 }, reason: "선명하게 고조되는 멜로디와 감정적인 클라이맥스가 어울려요.", searchQuery: "Official髭男dism 宿命 official" },
  { id: "goose-house-hikaru-nara", artist: "Goose house", title: "光るなら", genreIds: ["jpop-band", "anime-jrock"], vector: { energy: 3.9, brightness: 4.9, distortion: 1.4, groove: 3.0, atmosphere: 1.5, complexity: 1.5, emotion: 4.0, accessibility: 4.8 }, reason: "청량한 합창감과 환하게 터지는 후렴이 당신의 밝은 면을 건드려요.", searchQuery: "Goose house 光るなら official" },
  { id: "yorushika-say-it", artist: "ヨルシカ", title: "言って。", genreIds: ["jpop-band", "alternative-rock"], vector: { energy: 3.0, brightness: 3.2, distortion: 1.8, groove: 2.5, atmosphere: 2.7, complexity: 2.1, emotion: 4.0, accessibility: 4.0 }, reason: "귀에 남는 멜로디 안에 서늘한 감정이 숨어 있는 곡이에요.", searchQuery: "ヨルシカ 言って official" },

  // J-ROCK / 애니록
  { id: "kana-boon-silhouette", artist: "KANA-BOON", title: "シルエット", genreIds: ["anime-jrock", "pop-punk"], vector: { energy: 4.8, brightness: 4.0, distortion: 3.0, groove: 3.6, atmosphere: 1.1, complexity: 1.3, emotion: 4.0, accessibility: 4.8 }, reason: "달려가는 기타와 한 번에 기억되는 후렴이 잘 맞아요.", searchQuery: "KANA-BOON シルエット official" },
  { id: "akfg-rewrite", artist: "ASIAN KUNG-FU GENERATION", title: "リライト", genreIds: ["anime-jrock", "alternative-rock"], vector: { energy: 4.6, brightness: 2.8, distortion: 3.8, groove: 3.0, atmosphere: 1.3, complexity: 1.8, emotion: 4.7, accessibility: 4.0 }, reason: "터질 듯 쌓이는 감정과 거친 기타의 조합이 시원하게 맞아들어요.", searchQuery: "ASIAN KUNG-FU GENERATION リライト official" },
  { id: "kessoku-band-seishun-complex", artist: "結束バンド", title: "青春コンプレックス", genreIds: ["anime-jrock", "alternative-rock"], vector: { energy: 4.3, brightness: 2.6, distortion: 3.4, groove: 3.2, atmosphere: 1.7, complexity: 2.8, emotion: 4.3, accessibility: 3.8 }, reason: "불안과 질주가 함께 있는 록 사운드를 좋아한다면 추천해요.", searchQuery: "結束バンド 青春コンプレックス official" },
  { id: "the-oral-cigarettes-kyouran", artist: "THE ORAL CIGARETTES", title: "狂乱 Hey Kids!!", genreIds: ["anime-jrock", "alternative-rock"], vector: { energy: 4.8, brightness: 2.2, distortion: 3.9, groove: 4.0, atmosphere: 1.2, complexity: 2.1, emotion: 4.2, accessibility: 4.0 }, reason: "빠르고 위험한 듯한 리듬과 강렬한 후렴에 끌리는 귀에 맞아요.", searchQuery: "THE ORAL CIGARETTES 狂乱 Hey Kids official" },
  { id: "burnout-syndromes-hikariare", artist: "BURNOUT SYNDROMES", title: "ヒカリアレ", genreIds: ["anime-jrock", "jpop-band"], vector: { energy: 4.5, brightness: 4.4, distortion: 2.6, groove: 3.0, atmosphere: 1.2, complexity: 1.5, emotion: 4.3, accessibility: 4.6 }, reason: "밝고 드라마틱하게 치고 올라가는 후렴을 좋아할 때 좋은 선택이에요.", searchQuery: "BURNOUT SYNDROMES ヒカリアレ official" },
  { id: "spyair-imagination", artist: "SPYAIR", title: "イマジネーション", genreIds: ["anime-jrock", "pop-punk"], vector: { energy: 4.7, brightness: 4.0, distortion: 3.1, groove: 3.4, atmosphere: 1.2, complexity: 1.5, emotion: 4.1, accessibility: 4.5 }, reason: "무대에서 함께 뛰고 싶어지는 추진력 있는 밴드곡이에요.", searchQuery: "SPYAIR イマジネーション official" },

  // 팝펑크 / 멜로딕 펑크
  { id: "ellegarden-missing", artist: "ELLEGARDEN", title: "Missing", genreIds: ["pop-punk", "alternative-rock"], vector: { energy: 4.6, brightness: 3.2, distortion: 3.5, groove: 3.8, atmosphere: 1.3, complexity: 1.4, emotion: 4.0, accessibility: 4.2 }, reason: "거칠지만 너무 무겁지 않은 질주감이 취향을 정확히 찌를 수 있어요.", searchQuery: "ELLEGARDEN Missing official" },
  { id: "wanima-tomoni", artist: "WANIMA", title: "ともに", genreIds: ["pop-punk", "jpop-band"], vector: { energy: 5.0, brightness: 4.8, distortion: 3.0, groove: 4.2, atmosphere: 0.8, complexity: 1.0, emotion: 4.0, accessibility: 4.8 }, reason: "전력으로 뛰고 따라 부르고 싶은 에너지가 잘 맞아요.", searchQuery: "WANIMA ともに official" },
  { id: "neck-deep-gold-steps", artist: "Neck Deep", title: "Gold Steps", genreIds: ["pop-punk"], vector: { energy: 5.0, brightness: 4.2, distortion: 3.5, groove: 4.0, atmosphere: 0.7, complexity: 1.2, emotion: 3.6, accessibility: 4.5 }, reason: "복잡한 고민보다 빠르게 달리는 기타가 필요할 때 어울려요.", searchQuery: "Neck Deep Gold Steps official" },
  { id: "green-day-basket-case", artist: "Green Day", title: "Basket Case", genreIds: ["pop-punk"], vector: { energy: 4.7, brightness: 3.6, distortion: 3.4, groove: 4.1, atmosphere: 0.7, complexity: 1.2, emotion: 3.5, accessibility: 4.8 }, reason: "즉각 반응하게 되는 리프와 후렴 중심의 취향에 잘 맞아요.", searchQuery: "Green Day Basket Case official" },
  { id: "totalfat-place-to-try", artist: "TOTALFAT", title: "Place to Try", genreIds: ["pop-punk", "anime-jrock"], vector: { energy: 4.9, brightness: 4.2, distortion: 3.6, groove: 4.0, atmosphere: 0.9, complexity: 1.4, emotion: 3.9, accessibility: 4.3 }, reason: "일본 밴드 특유의 청량감과 펑크의 속도감을 동시에 느낄 수 있어요.", searchQuery: "TOTALFAT Place to Try official" },
  { id: "hi-standard-stay-gold", artist: "Hi-STANDARD", title: "STAY GOLD", genreIds: ["pop-punk"], vector: { energy: 4.9, brightness: 4.1, distortion: 3.4, groove: 4.0, atmosphere: 0.8, complexity: 1.0, emotion: 3.7, accessibility: 4.4 }, reason: "짧고 빠르게 마음을 끌어올리는 멜로딕 펑크의 맛이 있어요.", searchQuery: "Hi-STANDARD STAY GOLD official" },

  // 얼터너티브 록
  { id: "radiohead-just", artist: "Radiohead", title: "Just", genreIds: ["alternative-rock"], vector: { energy: 4.0, brightness: 1.6, distortion: 4.0, groove: 3.0, atmosphere: 2.0, complexity: 3.2, emotion: 4.0, accessibility: 2.5 }, reason: "불편할 정도로 긴장감 있는 기타와 감정의 질감이 맞아요.", searchQuery: "Radiohead Just official" },
  { id: "nirvana-breed", artist: "Nirvana", title: "Breed", genreIds: ["alternative-rock", "metalcore"], vector: { energy: 4.8, brightness: 0.9, distortion: 4.7, groove: 3.3, atmosphere: 1.2, complexity: 1.4, emotion: 4.6, accessibility: 2.0 }, reason: "정제되지 않은 힘과 소음에 가까운 해방감을 좋아할 때 추천해요.", searchQuery: "Nirvana Breed official" },
  { id: "number-girl-omoide-in-my-head", artist: "NUMBER GIRL", title: "OMOIDE IN MY HEAD", genreIds: ["alternative-rock"], vector: { energy: 4.4, brightness: 1.5, distortion: 4.5, groove: 2.8, atmosphere: 2.0, complexity: 2.7, emotion: 4.5, accessibility: 1.9 }, reason: "날것의 기타와 날카로운 정서를 찾는 귀에 어울려요.", searchQuery: "NUMBER GIRL OMOIDE IN MY HEAD official" },
  { id: "mass-of-the-fermenting-dregs-aoi-koi", artist: "MASS OF THE FERMENTING DREGS", title: "青い、濃い、橙色の日", genreIds: ["alternative-rock", "shoegaze-dreampop"], vector: { energy: 4.1, brightness: 1.9, distortion: 4.0, groove: 2.4, atmosphere: 3.3, complexity: 2.4, emotion: 4.5, accessibility: 2.0 }, reason: "거친 기타가 감정적인 여운으로 이어지는 곡을 좋아한다면 잘 맞아요.", searchQuery: "MASS OF THE FERMENTING DREGS 青い 濃い 橙色の日 official" },
  { id: "art-school-skirt", artist: "ART-SCHOOL", title: "スカートの色は青", genreIds: ["alternative-rock", "shoegaze-dreampop"], vector: { energy: 3.2, brightness: 1.7, distortion: 3.5, groove: 2.0, atmosphere: 3.2, complexity: 2.0, emotion: 4.3, accessibility: 2.2 }, reason: "서늘하고 상처 난 듯한 록의 결이 잘 맞을 수 있어요.", searchQuery: "ART-SCHOOL スカートの色は青 official" },
  { id: "the-smashing-pumpkins-cherub-rock", artist: "The Smashing Pumpkins", title: "Cherub Rock", genreIds: ["alternative-rock", "shoegaze-dreampop"], vector: { energy: 4.0, brightness: 2.1, distortion: 4.2, groove: 2.7, atmosphere: 3.5, complexity: 2.6, emotion: 4.0, accessibility: 2.6 }, reason: "풍성한 기타 층과 강한 록 에너지 사이를 좋아하는 사람에게 맞아요.", searchQuery: "The Smashing Pumpkins Cherub Rock official" },

  // 슈게이즈 / 드림팝
  { id: "hitsujibungaku-more-than-words", artist: "羊文学", title: "more than words", genreIds: ["shoegaze-dreampop", "alternative-rock"], vector: { energy: 2.3, brightness: 2.1, distortion: 2.5, groove: 1.6, atmosphere: 4.7, complexity: 2.2, emotion: 4.0, accessibility: 2.8 }, reason: "잔잔히 시작해 감정이 넓게 번지는 기타 공간감이 잘 맞아요.", searchQuery: "羊文学 more than words official" },
  { id: "slowdive-when-the-sun-hits", artist: "Slowdive", title: "When the Sun Hits", genreIds: ["shoegaze-dreampop"], vector: { energy: 2.4, brightness: 1.8, distortion: 3.2, groove: 1.4, atmosphere: 5.0, complexity: 2.4, emotion: 4.0, accessibility: 1.8 }, reason: "소리가 파도처럼 번지고 가라앉는 감각을 좋아한다면 정확히 맞아요.", searchQuery: "Slowdive When the Sun Hits official" },
  { id: "for-tracy-hyde-underwater-girl", artist: "For Tracy Hyde", title: "Underwater Girl", genreIds: ["shoegaze-dreampop"], vector: { energy: 2.4, brightness: 2.8, distortion: 2.8, groove: 2.0, atmosphere: 4.6, complexity: 2.1, emotion: 3.5, accessibility: 2.5 }, reason: "몽환성과 반짝임을 함께 가진 기타팝 질감이 잘 어울려요.", searchQuery: "For Tracy Hyde Underwater Girl official" },
  { id: "kinokoteikoku-eureka", artist: "きのこ帝国", title: "ユーリカ", genreIds: ["shoegaze-dreampop", "alternative-rock"], vector: { energy: 2.2, brightness: 1.4, distortion: 3.1, groove: 1.4, atmosphere: 4.9, complexity: 2.5, emotion: 4.4, accessibility: 1.7 }, reason: "서늘한 여운과 번지는 기타에 오래 머무는 타입이라면 추천해요.", searchQuery: "きのこ帝国 ユーリカ official" },
  { id: "my-bloody-valentine-when-you-sleep", artist: "My Bloody Valentine", title: "When You Sleep", genreIds: ["shoegaze-dreampop"], vector: { energy: 2.7, brightness: 2.0, distortion: 4.1, groove: 1.5, atmosphere: 5.0, complexity: 3.0, emotion: 3.7, accessibility: 1.4 }, reason: "기타가 하나의 질감처럼 들리는 몰입형 취향에 맞아요.", searchQuery: "My Bloody Valentine When You Sleep official" },
  { id: "supercar-cream-soda", artist: "SUPERCAR", title: "cream soda", genreIds: ["shoegaze-dreampop", "jpop-band"], vector: { energy: 2.6, brightness: 3.1, distortion: 2.2, groove: 2.3, atmosphere: 4.1, complexity: 2.0, emotion: 3.1, accessibility: 3.0 }, reason: "몽환적인 공간감 안에서도 팝한 멜로디를 놓치고 싶지 않을 때 어울려요.", searchQuery: "SUPERCAR cream soda official" },

  // 시티팝 / 펑크팝
  { id: "suchmos-stay-tune", artist: "Suchmos", title: "STAY TUNE", genreIds: ["citypop-funkpop"], vector: { energy: 3.5, brightness: 3.6, distortion: 0.8, groove: 5.0, atmosphere: 2.2, complexity: 2.0, emotion: 1.8, accessibility: 4.0 }, reason: "힘을 빼고도 몸이 움직이는 도시적인 그루브가 잘 맞아요.", searchQuery: "Suchmos STAY TUNE official" },
  { id: "lucky-kilimanjaro-burning-friday-night", artist: "Lucky Kilimanjaro", title: "Burning Friday Night", genreIds: ["citypop-funkpop", "jpop-band"], vector: { energy: 4.0, brightness: 4.5, distortion: 0.5, groove: 5.0, atmosphere: 1.7, complexity: 1.7, emotion: 2.2, accessibility: 4.4 }, reason: "밝은 기분 전환과 춤추는 리듬을 동시에 원하는 귀에 어울려요.", searchQuery: "Lucky Kilimanjaro Burning Friday Night official" },
  { id: "nulbarich-new-era", artist: "Nulbarich", title: "NEW ERA", genreIds: ["citypop-funkpop"], vector: { energy: 3.0, brightness: 3.4, distortion: 0.6, groove: 4.7, atmosphere: 2.4, complexity: 2.2, emotion: 1.8, accessibility: 3.8 }, reason: "매끈한 밴드 사운드와 여유 있는 리듬을 좋아한다면 추천해요.", searchQuery: "Nulbarich NEW ERA official" },
  { id: "bradio-flyers", artist: "BRADIO", title: "Flyers", genreIds: ["citypop-funkpop", "anime-jrock"], vector: { energy: 4.3, brightness: 4.4, distortion: 1.2, groove: 4.9, atmosphere: 1.2, complexity: 1.8, emotion: 2.8, accessibility: 4.6 }, reason: "무대처럼 신나고 탄력 있는 베이스와 리듬을 원할 때 좋아요.", searchQuery: "BRADIO Flyers official" },
  { id: "cody-lee-wo-ai-ni", artist: "Cody・Lee(李)", title: "我愛你", genreIds: ["citypop-funkpop", "jpop-band"], vector: { energy: 3.0, brightness: 3.8, distortion: 1.0, groove: 4.0, atmosphere: 2.8, complexity: 2.1, emotion: 2.8, accessibility: 3.8 }, reason: "가볍게 반짝이면서도 개성 있는 도시 감성을 좋아한다면 맞아요.", searchQuery: "Cody Lee 我愛你 official" },
  { id: "frederic-oddloop", artist: "フレデリック", title: "オドループ", genreIds: ["citypop-funkpop", "jpop-band"], vector: { energy: 4.0, brightness: 4.0, distortion: 1.3, groove: 5.0, atmosphere: 1.5, complexity: 2.0, emotion: 2.1, accessibility: 4.6 }, reason: "반복되는 리듬이 중독적으로 몸을 끌어가는 곡이에요.", searchQuery: "フレデリック オドループ official" },

  // 매스록 / 프로그레시브 록
  { id: "toe-goodbye", artist: "toe", title: "グッドバイ", genreIds: ["math-progressive", "shoegaze-dreampop"], vector: { energy: 2.7, brightness: 1.7, distortion: 2.1, groove: 3.7, atmosphere: 4.1, complexity: 4.5, emotion: 4.0, accessibility: 1.6 }, reason: "섬세한 합주가 쌓여 큰 여운이 되는 음악에 끌린다면 추천해요.", searchQuery: "toe グッドバイ official" },
  { id: "lite-double", artist: "LITE", title: "Double", genreIds: ["math-progressive"], vector: { energy: 3.7, brightness: 2.2, distortion: 2.7, groove: 4.1, atmosphere: 2.2, complexity: 4.9, emotion: 2.0, accessibility: 1.0 }, reason: "정교한 박자와 악기 대화 자체를 재미있게 듣는 귀에 맞아요.", searchQuery: "LITE Double official" },
  { id: "tricot-ochansensu-su", artist: "tricot", title: "おちゃんせんすぅす", genreIds: ["math-progressive", "alternative-rock"], vector: { energy: 4.0, brightness: 2.5, distortion: 3.0, groove: 4.0, atmosphere: 2.0, complexity: 5.0, emotion: 3.0, accessibility: 1.2 }, reason: "예상할 수 없이 튀는 합주와 록 에너지의 조합을 즐길 수 있어요.", searchQuery: "tricot おちゃんせんすぅす official" },
  { id: "covet-shibuya", artist: "Covet", title: "shibuya", genreIds: ["math-progressive"], vector: { energy: 2.8, brightness: 3.1, distortion: 1.4, groove: 3.6, atmosphere: 3.3, complexity: 4.7, emotion: 2.2, accessibility: 1.5 }, reason: "복잡하지만 맑은 기타 선율로 접근하고 싶을 때 좋은 입문곡이에요.", searchQuery: "Covet shibuya official" },
  { id: "chon-perfect-pillow", artist: "CHON", title: "Perfect Pillow", genreIds: ["math-progressive"], vector: { energy: 3.5, brightness: 3.7, distortion: 1.9, groove: 4.0, atmosphere: 2.5, complexity: 4.6, emotion: 2.0, accessibility: 1.8 }, reason: "정교한 연주 안에서도 밝고 경쾌한 흐름을 찾는다면 어울려요.", searchQuery: "CHON Perfect Pillow official" },
  { id: "mouse-on-the-keys-seiren", artist: "mouse on the keys", title: "seiren", genreIds: ["math-progressive"], vector: { energy: 3.6, brightness: 1.8, distortion: 1.2, groove: 4.4, atmosphere: 3.2, complexity: 5.0, emotion: 2.4, accessibility: 0.8 }, reason: "리듬과 구조 자체를 탐험하는 듯 듣고 싶은 날 맞아요.", searchQuery: "mouse on the keys seiren official" },

  // 메탈 / 메탈코어
  { id: "coldrain-mayday", artist: "coldrain", title: "MAYDAY (feat. Ryo from Crystal Lake)", genreIds: ["metalcore"], vector: { energy: 5.0, brightness: 0.7, distortion: 5.0, groove: 3.8, atmosphere: 1.5, complexity: 3.0, emotion: 5.0, accessibility: 1.4 }, reason: "무거운 리프와 강한 보컬이 동시에 밀어붙이는 감각을 좋아한다면 맞아요.", searchQuery: "coldrain MAYDAY Ryo Crystal Lake official" },
  { id: "crossfaith-monolith", artist: "Crossfaith", title: "Monolith", genreIds: ["metalcore"], vector: { energy: 5.0, brightness: 0.8, distortion: 5.0, groove: 4.1, atmosphere: 2.0, complexity: 3.2, emotion: 4.7, accessibility: 1.0 }, reason: "전자적 질감과 압도적인 밴드 에너지가 함께 터지는 곡이에요.", searchQuery: "Crossfaith Monolith official" },
  { id: "bring-me-the-horizon-throne", artist: "Bring Me The Horizon", title: "Throne", genreIds: ["metalcore", "alternative-rock"], vector: { energy: 4.8, brightness: 1.3, distortion: 4.5, groove: 3.8, atmosphere: 1.9, complexity: 2.2, emotion: 4.8, accessibility: 2.8 }, reason: "강한 사운드에도 선명한 후렴이 필요하다면 좋은 접점이에요.", searchQuery: "Bring Me The Horizon Throne official" },
  { id: "crystal-lake-apollo", artist: "Crystal Lake", title: "Apollo", genreIds: ["metalcore"], vector: { energy: 5.0, brightness: 0.5, distortion: 5.0, groove: 3.7, atmosphere: 1.4, complexity: 3.3, emotion: 4.9, accessibility: 0.8 }, reason: "한계까지 몰아붙이는 강도 높은 사운드를 원할 때 어울려요.", searchQuery: "Crystal Lake Apollo official" },
  { id: "sim-the-rumbling", artist: "SiM", title: "The Rumbling", genreIds: ["metalcore", "anime-jrock"], vector: { energy: 5.0, brightness: 0.8, distortion: 4.8, groove: 4.1, atmosphere: 1.5, complexity: 2.4, emotion: 5.0, accessibility: 2.4 }, reason: "압도적인 에너지에 기억되는 훅까지 원한다면 잘 맞아요.", searchQuery: "SiM The Rumbling official" },
  { id: "maximum-the-hormone-whats-up-people", artist: "MAXIMUM THE HORMONE", title: "What's up, people?!", genreIds: ["metalcore"], vector: { energy: 5.0, brightness: 1.0, distortion: 4.9, groove: 4.2, atmosphere: 1.0, complexity: 3.7, emotion: 4.8, accessibility: 0.9 }, reason: "혼란스럽고 과격한 에너지까지 즐길 수 있는 귀라면 도전할 만해요.", searchQuery: "MAXIMUM THE HORMONE What's up people official" },

  // ── 확장 곡 (2026-05-27) — 장르당 +8 ──
  // J-POP 밴드 / 팝록
  { id: "back-number-takane", artist: "back number", title: "高嶺の花子さん", genreIds: ["jpop-band"], vector: { energy: 3.6, brightness: 4.4, distortion: 1.8, groove: 3.2, atmosphere: 1.4, complexity: 1.3, emotion: 3.8, accessibility: 4.7 }, reason: "설레는 청춘 감성과 또렷한 후렴이 밝은 밴드 취향에 잘 맞아요.", searchQuery: "back number 高嶺の花子さん official" },
  { id: "radwimps-zenzenzense", artist: "RADWIMPS", title: "前前前世", genreIds: ["jpop-band", "anime-jrock"], vector: { energy: 4.4, brightness: 4.2, distortion: 2.4, groove: 3.4, atmosphere: 1.5, complexity: 2.0, emotion: 4.0, accessibility: 4.6 }, reason: "질주하는 밴드 사운드와 영화 같은 고조감을 함께 좋아한다면 추천해요.", searchQuery: "RADWIMPS 前前前世 official" },
  { id: "hige-dandism-pretender", artist: "Official髭男dism", title: "Pretender", genreIds: ["jpop-band"], vector: { energy: 3.6, brightness: 4.0, distortion: 1.3, groove: 3.4, atmosphere: 1.6, complexity: 2.2, emotion: 4.3, accessibility: 4.7 }, reason: "세련된 코드 진행과 절절한 감정선이 함께 살아 있는 곡이에요.", searchQuery: "Official髭男dism Pretender official" },
  { id: "king-gnu-hakujitsu", artist: "King Gnu", title: "白日", genreIds: ["jpop-band", "alternative-rock"], vector: { energy: 3.4, brightness: 2.6, distortion: 1.8, groove: 3.6, atmosphere: 2.6, complexity: 3.2, emotion: 4.4, accessibility: 3.6 }, reason: "대중성과 실험성을 함께 쥔, 어둡고 깊은 밴드 팝이에요.", searchQuery: "King Gnu 白日 official" },
  { id: "saucy-dog-cinderella-boy", artist: "Saucy Dog", title: "シンデレラボーイ", genreIds: ["jpop-band"], vector: { energy: 3.2, brightness: 3.6, distortion: 1.6, groove: 3.0, atmosphere: 2.2, complexity: 1.6, emotion: 4.2, accessibility: 4.4 }, reason: "담백한 밴드 편성에 먹먹한 감정이 스며드는 곡이에요.", searchQuery: "Saucy Dog シンデレラボーイ official" },
  { id: "alexandros-wataridori", artist: "[Alexandros]", title: "ワタリドリ", genreIds: ["jpop-band", "pop-punk"], vector: { energy: 4.8, brightness: 4.0, distortion: 3.2, groove: 3.8, atmosphere: 1.2, complexity: 1.6, emotion: 3.8, accessibility: 4.4 }, reason: "시원하게 날아가는 기타와 질주감이 폭발하는 밴드곡이에요.", searchQuery: "[Alexandros] ワタリドリ official" },
  { id: "unison-sugar-song", artist: "UNISON SQUARE GARDEN", title: "シュガーソングとビターステップ", genreIds: ["jpop-band", "anime-jrock"], vector: { energy: 4.4, brightness: 4.4, distortion: 2.4, groove: 4.4, atmosphere: 1.2, complexity: 2.6, emotion: 3.2, accessibility: 4.6 }, reason: "통통 튀는 리듬과 화려한 연주가 밝게 굴러가는 곡이에요.", searchQuery: "UNISON SQUARE GARDEN シュガーソングとビターステップ official" },
  { id: "flumpool-kimi-ni-todoke", artist: "flumpool", title: "君に届け", genreIds: ["jpop-band"], vector: { energy: 3.6, brightness: 4.2, distortion: 1.8, groove: 3.0, atmosphere: 1.4, complexity: 1.4, emotion: 4.2, accessibility: 4.6 }, reason: "곧게 뻗는 보컬과 따뜻한 후렴이 응원가처럼 다가와요.", searchQuery: "flumpool 君に届け official" },

  // J-ROCK / 애니록
  { id: "uverworld-core-pride", artist: "UVERworld", title: "CORE PRIDE", genreIds: ["anime-jrock"], vector: { energy: 4.7, brightness: 3.4, distortion: 3.6, groove: 3.6, atmosphere: 1.4, complexity: 2.0, emotion: 4.4, accessibility: 3.8 }, reason: "거친 추진력과 외치는 듯한 후렴이 뜨겁게 몰아쳐요.", searchQuery: "UVERworld CORE PRIDE official" },
  { id: "flow-go", artist: "FLOW", title: "GO!!!", genreIds: ["anime-jrock", "pop-punk"], vector: { energy: 4.8, brightness: 4.0, distortion: 3.2, groove: 3.6, atmosphere: 1.0, complexity: 1.4, emotion: 4.0, accessibility: 4.6 }, reason: "시작부터 끝까지 달리는 청춘 애니록의 대표격이에요.", searchQuery: "FLOW GO!!! official" },
  { id: "akfg-haruka-kanata", artist: "ASIAN KUNG-FU GENERATION", title: "遥か彼方", genreIds: ["anime-jrock"], vector: { energy: 4.7, brightness: 3.2, distortion: 3.8, groove: 3.4, atmosphere: 1.4, complexity: 2.0, emotion: 4.3, accessibility: 4.2 }, reason: "거칠게 질주하는 기타와 폭발하는 후렴이 정확히 취향을 찔러요.", searchQuery: "ASIAN KUNG-FU GENERATION 遥か彼方 official" },
  { id: "kana-boon-naimono-nedari", artist: "KANA-BOON", title: "ないものねだり", genreIds: ["anime-jrock", "pop-punk"], vector: { energy: 4.6, brightness: 4.2, distortion: 2.8, groove: 4.0, atmosphere: 1.1, complexity: 1.6, emotion: 3.8, accessibility: 4.7 }, reason: "통통 튀는 리듬과 따라 부르기 좋은 후렴이 경쾌해요.", searchQuery: "KANA-BOON ないものねだり official" },
  { id: "kessoku-guitar-to-kodoku", artist: "結束バンド", title: "ギターと孤独と蒼い惑星", genreIds: ["anime-jrock", "alternative-rock"], vector: { energy: 4.0, brightness: 2.8, distortion: 3.2, groove: 3.2, atmosphere: 1.8, complexity: 2.6, emotion: 4.2, accessibility: 3.8 }, reason: "외로움을 안고 달리는 기타 록을 좋아한다면 잘 맞아요.", searchQuery: "結束バンド ギターと孤独と蒼い惑星 official" },
  { id: "super-beaver-namae-wo-yobu", artist: "SUPER BEAVER", title: "名前を呼ぶよ", genreIds: ["anime-jrock"], vector: { energy: 4.2, brightness: 3.4, distortion: 3.0, groove: 3.2, atmosphere: 1.4, complexity: 1.6, emotion: 4.6, accessibility: 4.2 }, reason: "진심을 그대로 외치는 보컬과 단단한 밴드 사운드가 인상적이에요.", searchQuery: "SUPER BEAVER 名前を呼ぶよ official" },
  { id: "lisa-gurenge", artist: "LiSA", title: "紅蓮華", genreIds: ["anime-jrock"], vector: { energy: 4.8, brightness: 3.2, distortion: 3.6, groove: 3.6, atmosphere: 1.2, complexity: 2.0, emotion: 4.6, accessibility: 4.4 }, reason: "강렬한 보컬과 치고 나가는 록 사운드가 시원하게 터져요.", searchQuery: "LiSA 紅蓮華 official" },
  { id: "unison-orion-wo-nazoru", artist: "UNISON SQUARE GARDEN", title: "オリオンをなぞる", genreIds: ["anime-jrock", "jpop-band"], vector: { energy: 4.4, brightness: 4.0, distortion: 2.6, groove: 4.2, atmosphere: 1.2, complexity: 2.4, emotion: 3.6, accessibility: 4.4 }, reason: "정교하면서도 신나는 리듬으로 굴러가는 애니 OP 명곡이에요.", searchQuery: "UNISON SQUARE GARDEN オリオンをなぞる official" },

  // 팝펑크 / 멜로딕 펑크
  { id: "blink182-all-the-small-things", artist: "blink-182", title: "All The Small Things", genreIds: ["pop-punk"], vector: { energy: 4.8, brightness: 4.2, distortion: 3.4, groove: 4.0, atmosphere: 0.7, complexity: 1.0, emotion: 3.2, accessibility: 5.0 }, reason: "단순하고 빠른 리프와 떼창 후렴, 팝펑크의 교과서예요.", searchQuery: "blink-182 All The Small Things official" },
  { id: "sum41-in-too-deep", artist: "Sum 41", title: "In Too Deep", genreIds: ["pop-punk"], vector: { energy: 4.8, brightness: 3.8, distortion: 3.6, groove: 4.0, atmosphere: 0.8, complexity: 1.2, emotion: 3.4, accessibility: 4.8 }, reason: "시원하게 달리는 기타와 외치고 싶은 후렴이 잘 맞아요.", searchQuery: "Sum 41 In Too Deep official" },
  { id: "ellegarden-make-a-wish", artist: "ELLEGARDEN", title: "Make A Wish", genreIds: ["pop-punk"], vector: { energy: 4.6, brightness: 3.6, distortion: 3.4, groove: 3.8, atmosphere: 1.0, complexity: 1.4, emotion: 3.8, accessibility: 4.4 }, reason: "거칠지만 멜로딕한 질주감을 좋아한다면 추천해요.", searchQuery: "ELLEGARDEN Make A Wish official" },
  { id: "all-time-low-dear-maria", artist: "All Time Low", title: "Dear Maria, Count Me In", genreIds: ["pop-punk"], vector: { energy: 4.7, brightness: 4.0, distortion: 3.4, groove: 4.0, atmosphere: 0.7, complexity: 1.0, emotion: 3.4, accessibility: 4.8 }, reason: "밝고 빠른 텐션으로 단숨에 끌어올리는 팝펑크예요.", searchQuery: "All Time Low Dear Maria Count Me In official" },
  { id: "shishamo-kimi-to-natsu-fes", artist: "SHISHAMO", title: "君と夏フェス", genreIds: ["pop-punk", "jpop-band"], vector: { energy: 4.2, brightness: 4.6, distortion: 2.2, groove: 3.4, atmosphere: 1.0, complexity: 1.0, emotion: 3.8, accessibility: 4.8 }, reason: "여름 페스 같은 청량함과 직진하는 밴드 사운드가 어울려요.", searchQuery: "SHISHAMO 君と夏フェス official" },
  { id: "04ls-swim", artist: "04 Limited Sazabys", title: "swim", genreIds: ["pop-punk"], vector: { energy: 4.9, brightness: 4.2, distortion: 3.4, groove: 4.2, atmosphere: 0.8, complexity: 1.2, emotion: 3.6, accessibility: 4.4 }, reason: "빠른 BPM과 높은 멜로디 라인이 시원하게 내달려요.", searchQuery: "04 Limited Sazabys swim official" },
  { id: "wanima-yattemiyou", artist: "WANIMA", title: "やってみよう", genreIds: ["pop-punk", "jpop-band"], vector: { energy: 5.0, brightness: 4.8, distortion: 3.0, groove: 4.2, atmosphere: 0.7, complexity: 1.0, emotion: 3.8, accessibility: 4.9 }, reason: "무조건 긍정의 에너지로 같이 뛰게 만드는 곡이에요.", searchQuery: "WANIMA やってみよう official" },
  { id: "green-day-american-idiot", artist: "Green Day", title: "American Idiot", genreIds: ["pop-punk"], vector: { energy: 4.9, brightness: 3.2, distortion: 3.8, groove: 4.0, atmosphere: 0.8, complexity: 1.4, emotion: 3.8, accessibility: 4.6 }, reason: "분노를 시원하게 내지르는 펑크록 앤섬이에요.", searchQuery: "Green Day American Idiot official" },

  // 얼터너티브 록
  { id: "radiohead-creep", artist: "Radiohead", title: "Creep", genreIds: ["alternative-rock"], vector: { energy: 3.0, brightness: 1.8, distortion: 3.6, groove: 2.4, atmosphere: 2.6, complexity: 2.0, emotion: 4.4, accessibility: 3.4 }, reason: "조용히 쌓이다 거칠게 터지는 자기혐오의 명곡이에요.", searchQuery: "Radiohead Creep official" },
  { id: "the-strokes-last-nite", artist: "The Strokes", title: "Last Nite", genreIds: ["alternative-rock"], vector: { energy: 3.8, brightness: 3.4, distortion: 3.0, groove: 3.6, atmosphere: 1.8, complexity: 1.6, emotion: 2.8, accessibility: 4.0 }, reason: "느슨하면서 중독적인 개러지 록 그루브가 매력이에요.", searchQuery: "The Strokes Last Nite official" },
  { id: "oasis-dont-look-back", artist: "Oasis", title: "Don't Look Back in Anger", genreIds: ["alternative-rock"], vector: { energy: 3.6, brightness: 3.0, distortion: 2.8, groove: 2.8, atmosphere: 2.0, complexity: 1.6, emotion: 4.2, accessibility: 4.4 }, reason: "누구나 따라 부르는 멜로디와 묵직한 여운이 함께 있어요.", searchQuery: "Oasis Don't Look Back in Anger official" },
  { id: "arctic-monkeys-do-i-wanna-know", artist: "Arctic Monkeys", title: "Do I Wanna Know?", genreIds: ["alternative-rock"], vector: { energy: 3.4, brightness: 1.8, distortion: 3.6, groove: 3.8, atmosphere: 2.6, complexity: 2.0, emotion: 3.8, accessibility: 3.6 }, reason: "끈적한 리프와 어두운 무드가 천천히 끌어당겨요.", searchQuery: "Arctic Monkeys Do I Wanna Know official" },
  { id: "smashing-pumpkins-1979", artist: "The Smashing Pumpkins", title: "1979", genreIds: ["alternative-rock", "shoegaze-dreampop"], vector: { energy: 3.2, brightness: 3.0, distortion: 2.6, groove: 3.2, atmosphere: 3.4, complexity: 1.8, emotion: 3.8, accessibility: 3.6 }, reason: "노스탤지어가 번지는 미드템포 얼터록이에요.", searchQuery: "The Smashing Pumpkins 1979 official" },
  { id: "pixies-where-is-my-mind", artist: "Pixies", title: "Where Is My Mind?", genreIds: ["alternative-rock", "shoegaze-dreampop"], vector: { energy: 3.4, brightness: 2.4, distortion: 3.2, groove: 2.6, atmosphere: 3.0, complexity: 2.0, emotion: 3.6, accessibility: 3.4 }, reason: "잔잔함과 폭발을 오가는 다이내믹이 오래 남아요.", searchQuery: "Pixies Where Is My Mind official" },
  { id: "number-girl-toumei-shoujo", artist: "NUMBER GIRL", title: "透明少女", genreIds: ["alternative-rock"], vector: { energy: 4.6, brightness: 1.8, distortion: 4.4, groove: 3.0, atmosphere: 1.8, complexity: 2.4, emotion: 4.4, accessibility: 2.2 }, reason: "날카롭게 긁는 기타와 절규가 폭주하는 일본 얼터록 명곡이에요.", searchQuery: "NUMBER GIRL 透明少女 official" },
  { id: "fujifabric-wakamono-no-subete", artist: "フジファブリック", title: "若者のすべて", genreIds: ["alternative-rock", "jpop-band"], vector: { energy: 2.8, brightness: 2.8, distortion: 1.8, groove: 2.6, atmosphere: 3.0, complexity: 1.8, emotion: 4.2, accessibility: 3.6 }, reason: "노을 같은 서정과 담담한 밴드 사운드가 깊게 스며요.", searchQuery: "フジファブリック 若者のすべて official" },

  // 슈게이즈 / 드림팝
  { id: "mbv-only-shallow", artist: "My Bloody Valentine", title: "Only Shallow", genreIds: ["shoegaze-dreampop"], vector: { energy: 3.0, brightness: 1.8, distortion: 4.4, groove: 1.8, atmosphere: 5.0, complexity: 3.0, emotion: 3.6, accessibility: 1.4 }, reason: "굉음 같은 기타 벽이 통째로 밀려오는 슈게이즈 원형이에요.", searchQuery: "My Bloody Valentine Only Shallow official" },
  { id: "cocteau-twins-cherry-coloured", artist: "Cocteau Twins", title: "Cherry-coloured Funk", genreIds: ["shoegaze-dreampop"], vector: { energy: 2.0, brightness: 2.8, distortion: 2.0, groove: 1.6, atmosphere: 5.0, complexity: 2.4, emotion: 3.6, accessibility: 1.8 }, reason: "알 수 없는 가사마저 악기처럼 번지는 드림팝이에요.", searchQuery: "Cocteau Twins Cherry-coloured Funk official" },
  { id: "hitsujibungaku-hikaru-toki", artist: "羊文学", title: "光るとき", genreIds: ["shoegaze-dreampop", "jpop-band"], vector: { energy: 3.2, brightness: 3.0, distortion: 2.8, groove: 2.2, atmosphere: 4.2, complexity: 2.0, emotion: 4.0, accessibility: 3.4 }, reason: "몽환적인 기타 위로 또렷한 멜로디가 빛나는 곡이에요.", searchQuery: "羊文学 光るとき official" },
  { id: "ride-vapour-trail", artist: "Ride", title: "Vapour Trail", genreIds: ["shoegaze-dreampop"], vector: { energy: 2.8, brightness: 2.8, distortion: 3.0, groove: 2.2, atmosphere: 4.6, complexity: 2.2, emotion: 3.8, accessibility: 2.4 }, reason: "반짝이며 흘러가는 기타가 맑은 여운을 남겨요.", searchQuery: "Ride Vapour Trail official" },
  { id: "beach-house-space-song", artist: "Beach House", title: "Space Song", genreIds: ["shoegaze-dreampop"], vector: { energy: 2.2, brightness: 2.8, distortion: 1.6, groove: 2.4, atmosphere: 4.8, complexity: 1.8, emotion: 3.6, accessibility: 3.0 }, reason: "둥둥 떠다니는 신스와 공간감이 깊게 감싸는 드림팝이에요.", searchQuery: "Beach House Space Song official" },
  { id: "kinokoteikoku-chronostasis", artist: "きのこ帝国", title: "クロノスタシス", genreIds: ["shoegaze-dreampop"], vector: { energy: 2.6, brightness: 2.0, distortion: 3.0, groove: 1.8, atmosphere: 4.7, complexity: 2.4, emotion: 4.2, accessibility: 2.0 }, reason: "서늘한 공기와 번지는 기타가 천천히 차오르는 곡이에요.", searchQuery: "きのこ帝国 クロノスタシス official" },
  { id: "jamc-just-like-honey", artist: "The Jesus and Mary Chain", title: "Just Like Honey", genreIds: ["shoegaze-dreampop"], vector: { energy: 2.6, brightness: 2.6, distortion: 3.4, groove: 2.6, atmosphere: 4.2, complexity: 1.6, emotion: 3.4, accessibility: 3.0 }, reason: "노이즈와 달콤한 멜로디가 동시에 흐르는 고전이에요.", searchQuery: "The Jesus and Mary Chain Just Like Honey official" },
  { id: "asobi-seksu-thursday", artist: "Asobi Seksu", title: "Thursday", genreIds: ["shoegaze-dreampop"], vector: { energy: 2.8, brightness: 3.0, distortion: 3.6, groove: 2.4, atmosphere: 4.6, complexity: 2.2, emotion: 3.4, accessibility: 2.2 }, reason: "청량한 보컬과 노이즈 기타가 함께 반짝이는 드림팝이에요.", searchQuery: "Asobi Seksu Thursday official" },

  // 시티팝 / 펑크팝
  { id: "cero-summer-soul", artist: "cero", title: "Summer Soul", genreIds: ["citypop-funkpop"], vector: { energy: 3.0, brightness: 3.6, distortion: 0.8, groove: 4.6, atmosphere: 2.8, complexity: 2.6, emotion: 2.2, accessibility: 3.4 }, reason: "세련된 화성과 나른한 그루브가 도시의 여름처럼 흘러요.", searchQuery: "cero Summer Soul official" },
  { id: "tatsuro-yamashita-ride-on-time", artist: "山下達郎", title: "RIDE ON TIME", genreIds: ["citypop-funkpop"], vector: { energy: 3.2, brightness: 4.2, distortion: 0.6, groove: 4.4, atmosphere: 2.0, complexity: 2.0, emotion: 2.6, accessibility: 4.2 }, reason: "시티팝의 원류, 반짝이는 코러스와 탄탄한 리듬이 살아 있어요.", searchQuery: "山下達郎 RIDE ON TIME official" },
  { id: "mariya-takeuchi-plastic-love", artist: "竹内まりや", title: "Plastic Love", genreIds: ["citypop-funkpop"], vector: { energy: 2.8, brightness: 3.8, distortion: 0.5, groove: 4.4, atmosphere: 2.4, complexity: 2.0, emotion: 2.8, accessibility: 4.0 }, reason: "도시의 밤 같은 멜로디, 시티팝 하면 떠오르는 그 곡이에요.", searchQuery: "竹内まりや Plastic Love official" },
  { id: "awesome-city-club-wasurena", artist: "Awesome City Club", title: "勿忘", genreIds: ["citypop-funkpop", "jpop-band"], vector: { energy: 3.0, brightness: 3.6, distortion: 1.0, groove: 3.8, atmosphere: 2.6, complexity: 1.8, emotion: 3.4, accessibility: 4.2 }, reason: "산뜻한 듀엣과 도시적인 무드가 부드럽게 섞인 곡이에요.", searchQuery: "Awesome City Club 勿忘 official" },
  { id: "vulfpeck-dean-town", artist: "Vulfpeck", title: "Dean Town", genreIds: ["citypop-funkpop"], vector: { energy: 3.4, brightness: 3.2, distortion: 0.6, groove: 5.0, atmosphere: 1.8, complexity: 3.0, emotion: 1.6, accessibility: 2.8 }, reason: "베이스 그루브 그 자체, 몸이 먼저 반응하는 펑크예요.", searchQuery: "Vulfpeck Dean Town official" },
  { id: "jamiroquai-virtual-insanity", artist: "Jamiroquai", title: "Virtual Insanity", genreIds: ["citypop-funkpop"], vector: { energy: 3.4, brightness: 3.6, distortion: 0.6, groove: 5.0, atmosphere: 2.0, complexity: 2.4, emotion: 2.0, accessibility: 4.0 }, reason: "매끈한 펑크/애시드 재즈 그루브가 끝없이 굴러가요.", searchQuery: "Jamiroquai Virtual Insanity official" },
  { id: "nulbarich-twilight", artist: "Nulbarich", title: "Twilight", genreIds: ["citypop-funkpop"], vector: { energy: 3.0, brightness: 3.4, distortion: 0.6, groove: 4.6, atmosphere: 2.6, complexity: 2.0, emotion: 2.0, accessibility: 3.8 }, reason: "여유로운 보컬과 도시적 리듬이 노을처럼 번져요.", searchQuery: "Nulbarich Twilight official" },
  { id: "tom-misch-it-runs-through-me", artist: "Tom Misch", title: "It Runs Through Me", genreIds: ["citypop-funkpop"], vector: { energy: 2.8, brightness: 3.4, distortion: 0.6, groove: 4.6, atmosphere: 2.6, complexity: 2.4, emotion: 2.2, accessibility: 3.4 }, reason: "기타 리프와 그루브가 나른하게 어우러지는 네오소울이에요.", searchQuery: "Tom Misch It Runs Through Me official" },

  // 매스록 / 프로그레시브 록
  { id: "toe-1-21", artist: "toe", title: "1/21", genreIds: ["math-progressive", "shoegaze-dreampop"], vector: { energy: 3.0, brightness: 2.0, distortion: 2.2, groove: 4.0, atmosphere: 3.8, complexity: 4.6, emotion: 3.4, accessibility: 1.4 }, reason: "섬세한 기타 탭핑과 변박이 촘촘하게 짜인 곡이에요.", searchQuery: "toe 1/21 official" },
  { id: "american-football-never-meant", artist: "American Football", title: "Never Meant", genreIds: ["math-progressive", "shoegaze-dreampop"], vector: { energy: 2.4, brightness: 3.0, distortion: 1.4, groove: 3.4, atmosphere: 3.6, complexity: 4.0, emotion: 3.6, accessibility: 2.4 }, reason: "엇갈리는 기타 패턴이 아련하게 맞물리는 이모/매스록이에요.", searchQuery: "American Football Never Meant official" },
  { id: "polyphia-goat", artist: "Polyphia", title: "G.O.A.T.", genreIds: ["math-progressive"], vector: { energy: 3.6, brightness: 3.4, distortion: 2.4, groove: 4.2, atmosphere: 2.0, complexity: 5.0, emotion: 1.8, accessibility: 1.6 }, reason: "화려한 핑거스타일 기타가 곡예처럼 펼쳐지는 곡이에요.", searchQuery: "Polyphia G.O.A.T. official" },
  { id: "chon-splash", artist: "CHON", title: "Splash", genreIds: ["math-progressive"], vector: { energy: 3.4, brightness: 3.6, distortion: 1.8, groove: 4.0, atmosphere: 2.4, complexity: 4.6, emotion: 1.8, accessibility: 1.8 }, reason: "맑고 통통 튀는 기타 인터플레이가 밝게 흐르는 곡이에요.", searchQuery: "CHON Splash official" },
  { id: "king-crimson-21st-century", artist: "King Crimson", title: "21st Century Schizoid Man", genreIds: ["math-progressive", "metalcore"], vector: { energy: 4.4, brightness: 1.6, distortion: 3.6, groove: 3.4, atmosphere: 2.4, complexity: 5.0, emotion: 3.6, accessibility: 1.6 }, reason: "프로그레시브 록의 원형, 난폭한 합주와 변박이 압도해요.", searchQuery: "King Crimson 21st Century Schizoid Man official" },
  { id: "tool-schism", artist: "TOOL", title: "Schism", genreIds: ["math-progressive", "alternative-rock"], vector: { energy: 4.0, brightness: 1.4, distortion: 3.8, groove: 3.8, atmosphere: 3.0, complexity: 4.8, emotion: 3.6, accessibility: 1.6 }, reason: "복잡한 박자 변화와 묵직한 사운드가 긴장감을 끌고 가요.", searchQuery: "TOOL Schism official" },
  { id: "battles-atlas", artist: "Battles", title: "Atlas", genreIds: ["math-progressive"], vector: { energy: 4.0, brightness: 2.6, distortion: 3.0, groove: 4.6, atmosphere: 2.8, complexity: 4.8, emotion: 2.0, accessibility: 1.8 }, reason: "루프처럼 반복되며 비틀리는 리듬이 중독적인 곡이에요.", searchQuery: "Battles Atlas official" },
  { id: "ling-tosite-sigure-abnormalize", artist: "凛として時雨", title: "abnormalize", genreIds: ["math-progressive", "anime-jrock"], vector: { energy: 4.4, brightness: 2.2, distortion: 3.8, groove: 3.6, atmosphere: 2.0, complexity: 4.2, emotion: 4.2, accessibility: 2.6 }, reason: "날카로운 고음 보컬과 촘촘한 합주가 폭주하는 곡이에요.", searchQuery: "凛として時雨 abnormalize official" },

  // 메탈 / 메탈코어
  { id: "bmth-can-you-feel-my-heart", artist: "Bring Me The Horizon", title: "Can You Feel My Heart", genreIds: ["metalcore"], vector: { energy: 4.6, brightness: 1.4, distortion: 4.2, groove: 3.6, atmosphere: 2.4, complexity: 2.0, emotion: 5.0, accessibility: 3.0 }, reason: "절규와 멜로디가 함께 폭발하는 메탈코어 앤섬이에요.", searchQuery: "Bring Me The Horizon Can You Feel My Heart official" },
  { id: "architects-doomsday", artist: "Architects", title: "Doomsday", genreIds: ["metalcore"], vector: { energy: 4.8, brightness: 1.0, distortion: 4.8, groove: 3.8, atmosphere: 2.0, complexity: 3.0, emotion: 4.8, accessibility: 2.0 }, reason: "묵직한 리프와 비극적인 멜로디가 압도적으로 밀려와요.", searchQuery: "Architects Doomsday official" },
  { id: "killswitch-engage-my-curse", artist: "Killswitch Engage", title: "My Curse", genreIds: ["metalcore"], vector: { energy: 4.8, brightness: 1.4, distortion: 4.6, groove: 3.6, atmosphere: 1.6, complexity: 2.4, emotion: 4.8, accessibility: 2.6 }, reason: "거친 절규와 시원한 멜로딕 후렴이 교차하는 곡이에요.", searchQuery: "Killswitch Engage My Curse official" },
  { id: "crystal-lake-devilcry", artist: "Crystal Lake", title: "Devilcry", genreIds: ["metalcore"], vector: { energy: 5.0, brightness: 0.6, distortion: 5.0, groove: 3.8, atmosphere: 1.4, complexity: 3.2, emotion: 4.8, accessibility: 1.0 }, reason: "최신 메탈코어의 묵직함을 그대로 보여주는 곡이에요.", searchQuery: "Crystal Lake Devilcry official" },
  { id: "parkway-drive-wild-eyes", artist: "Parkway Drive", title: "Wild Eyes", genreIds: ["metalcore"], vector: { energy: 4.9, brightness: 0.9, distortion: 4.8, groove: 3.8, atmosphere: 2.0, complexity: 2.6, emotion: 4.6, accessibility: 1.6 }, reason: "라이브 떼창으로 유명한 거대한 메탈코어 트랙이에요.", searchQuery: "Parkway Drive Wild Eyes official" },
  { id: "august-burns-red-composure", artist: "August Burns Red", title: "Composure", genreIds: ["metalcore"], vector: { energy: 5.0, brightness: 0.8, distortion: 5.0, groove: 3.6, atmosphere: 1.4, complexity: 3.6, emotion: 4.4, accessibility: 0.9 }, reason: "정교한 리프와 폭주하는 드럼이 빈틈없이 몰아쳐요.", searchQuery: "August Burns Red Composure official" },
  { id: "crossfaith-madness", artist: "Crossfaith", title: "Madness", genreIds: ["metalcore"], vector: { energy: 5.0, brightness: 1.0, distortion: 4.9, groove: 4.2, atmosphere: 1.8, complexity: 3.0, emotion: 4.6, accessibility: 1.4 }, reason: "전자음과 메탈이 광란처럼 뒤섞이는 곡이에요.", searchQuery: "Crossfaith Madness official" },
  { id: "bfmv-tears-dont-fall", artist: "Bullet For My Valentine", title: "Tears Don't Fall", genreIds: ["metalcore"], vector: { energy: 4.8, brightness: 1.6, distortion: 4.4, groove: 3.6, atmosphere: 1.8, complexity: 2.4, emotion: 4.8, accessibility: 3.0 }, reason: "강렬한 리프와 애절한 멜로디가 공존하는 메탈코어 명곡이에요.", searchQuery: "Bullet For My Valentine Tears Don't Fall official" },
];
