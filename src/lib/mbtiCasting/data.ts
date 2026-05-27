// src/lib/mbtiCasting/data.ts
// MBTI 밴드 캐스팅 콘텐츠 DB. (원본 mbtiBandData.ts 이식)
import type {
  BudgetId, ExperienceId, GenreDefinition, GenreId, MbtiId, MbtiProfile,
  PositionDefinition, PositionId, SoundPreferenceId,
  StagePreferenceId, WeightedOption,
} from "./types";

// (data.ts 에서 직접 참조하지 않는 PositionScores 는 import 하지 않는다 — lint 통과.
//  positionBoosts/baseScores 객체 리터럴의 타입은 위 interface 들이 제공한다.)

export const POSITION_PRIORITY: PositionId[] = [
  "vocal", "leadGuitar", "rhythmGuitar", "bass", "drums", "keyboard",
];

export const POSITIONS: Record<PositionId, PositionDefinition> = {
  vocal: {
    id: "vocal",
    label: "보컬",
    englishLabel: "VOCAL",
    icon: "🎤",
    keyword: "목소리",
    baseDescription: "가사와 멜로디를 관객에게 가장 먼저 전하는 밴드의 얼굴",
  },
  leadGuitar: {
    id: "leadGuitar",
    label: "리드 기타",
    englishLabel: "LEAD GUITAR",
    icon: "🎸",
    keyword: "반짝이는 솔로",
    baseDescription: "리프와 솔로로 곡의 결정적인 장면을 만드는 포지션",
  },
  rhythmGuitar: {
    id: "rhythmGuitar",
    label: "리듬 기타",
    englishLabel: "RHYTHM GUITAR",
    icon: "⚡",
    keyword: "추진력",
    baseDescription: "코드와 리듬으로 밴드 사운드를 앞으로 밀어주는 포지션",
  },
  bass: {
    id: "bass",
    label: "베이스",
    englishLabel: "BASS",
    icon: "🌙",
    keyword: "깊은 저음",
    baseDescription: "드럼과 멜로디 사이를 연결하며 곡의 중심을 잡아주는 포지션",
  },
  drums: {
    id: "drums",
    label: "드럼",
    englishLabel: "DRUMS",
    icon: "🥁",
    keyword: "심장박동",
    baseDescription: "박자와 에너지로 합주 전체를 움직이는 밴드의 엔진",
  },
  keyboard: {
    id: "keyboard",
    label: "키보드·신스",
    englishLabel: "KEYBOARD / SYNTH",
    icon: "✨",
    keyword: "공간감",
    baseDescription: "화성과 음색으로 곡의 분위기와 세계관을 확장하는 포지션",
  },
};

export const GENRES: Record<GenreId, GenreDefinition> = {
  jPop: {
    id: "jPop",
    label: "J-POP",
    shortDescription: "선명한 멜로디와 다채로운 전개",
    positionBoosts: { vocal: 3, leadGuitar: 1, rhythmGuitar: 1, bass: 1, drums: 1, keyboard: 3 },
    moodTags: ["컬러풀", "멜로디", "청량"],
  },
  jRock: {
    id: "jRock",
    label: "J-ROCK",
    shortDescription: "질주하는 밴드 사운드와 청춘의 후렴",
    positionBoosts: { vocal: 2, leadGuitar: 3, rhythmGuitar: 3, bass: 2, drums: 2, keyboard: 0 },
    moodTags: ["청춘", "질주", "벅참"],
  },
  popPunk: {
    id: "popPunk",
    label: "팝펑크",
    shortDescription: "직진하는 에너지와 떼창 가능한 후렴",
    positionBoosts: { vocal: 3, leadGuitar: 2, rhythmGuitar: 4, bass: 1, drums: 3, keyboard: 0 },
    moodTags: ["반항", "속도감", "여름"],
  },
  alternative: {
    id: "alternative",
    label: "얼터너티브",
    shortDescription: "거친 질감과 예상 밖의 감정선",
    positionBoosts: { vocal: 2, leadGuitar: 3, rhythmGuitar: 2, bass: 3, drums: 2, keyboard: 2 },
    moodTags: ["잔상", "강렬", "실험적"],
  },
  indieRock: {
    id: "indieRock",
    label: "인디록",
    shortDescription: "일상적인 가사와 취향이 드러나는 톤",
    positionBoosts: { vocal: 2, leadGuitar: 2, rhythmGuitar: 3, bass: 2, drums: 1, keyboard: 2 },
    moodTags: ["산책", "취향", "나른함"],
  },
  cityPop: {
    id: "cityPop",
    label: "시티팝",
    shortDescription: "도시의 밤과 매끄러운 그루브",
    positionBoosts: { vocal: 2, leadGuitar: 1, rhythmGuitar: 1, bass: 4, drums: 2, keyboard: 4 },
    moodTags: ["야경", "그루브", "네온"],
  },
  metalHeavyRock: {
    id: "metalHeavyRock",
    label: "메탈·헤비록",
    shortDescription: "강력한 리프와 폭발하는 에너지",
    positionBoosts: { vocal: 2, leadGuitar: 4, rhythmGuitar: 4, bass: 2, drums: 4, keyboard: 0 },
    moodTags: ["폭발", "하이게인", "중량감"],
  },
};

export const STAGE_PREFERENCES: WeightedOption<StagePreferenceId>[] = [
  {
    id: "spotlight",
    label: "사람들의 시선을 한몸에 받는 순간",
    positionBoosts: { vocal: 5, leadGuitar: 2, rhythmGuitar: 0, bass: 0, drums: 1, keyboard: 0 },
  },
  {
    id: "signature",
    label: "결정적인 연주로 분위기를 바꾸는 순간",
    positionBoosts: { vocal: 1, leadGuitar: 5, rhythmGuitar: 2, bass: 1, drums: 2, keyboard: 3 },
  },
  {
    id: "foundation",
    label: "뒤에서 곡 전체를 단단하게 받치는 순간",
    positionBoosts: { vocal: 0, leadGuitar: 0, rhythmGuitar: 4, bass: 5, drums: 3, keyboard: 1 },
  },
  {
    id: "groove",
    label: "리듬으로 관객을 움직이게 하는 순간",
    positionBoosts: { vocal: 1, leadGuitar: 1, rhythmGuitar: 2, bass: 4, drums: 5, keyboard: 1 },
  },
  {
    id: "texture",
    label: "새로운 소리로 분위기와 세계관을 만드는 순간",
    positionBoosts: { vocal: 1, leadGuitar: 2, rhythmGuitar: 1, bass: 2, drums: 0, keyboard: 5 },
  },
];

export const SOUND_PREFERENCES: WeightedOption<SoundPreferenceId>[] = [
  {
    id: "voice",
    label: "시원한 고음과 기억에 남는 후렴구",
    positionBoosts: { vocal: 5, leadGuitar: 0, rhythmGuitar: 1, bass: 0, drums: 0, keyboard: 1 },
  },
  {
    id: "riff",
    label: "날카로운 기타 리프와 솔로",
    positionBoosts: { vocal: 0, leadGuitar: 5, rhythmGuitar: 4, bass: 1, drums: 1, keyboard: 0 },
  },
  {
    id: "lowEnd",
    label: "묵직하고 깊은 저음",
    positionBoosts: { vocal: 0, leadGuitar: 1, rhythmGuitar: 1, bass: 5, drums: 2, keyboard: 1 },
  },
  {
    id: "beat",
    label: "폭발적인 비트와 드럼 필인",
    positionBoosts: { vocal: 0, leadGuitar: 1, rhythmGuitar: 1, bass: 2, drums: 5, keyboard: 0 },
  },
  {
    id: "synth",
    label: "반짝이는 신스와 공간감 있는 사운드",
    positionBoosts: { vocal: 1, leadGuitar: 0, rhythmGuitar: 0, bass: 1, drums: 0, keyboard: 5 },
  },
];

export const EXPERIENCES: { id: ExperienceId; label: string }[] = [
  { id: "beginner", label: "아직 악기를 다뤄본 적이 없어요" },
  { id: "starter", label: "막 시작했거나 입문 장비를 찾고 있어요" },
  { id: "player", label: "이미 연주하고 있어요" },
];

export const BUDGETS: { id: BudgetId; label: string }[] = [
  { id: "browse", label: "아직 구매 계획 없이 구경할래요" },
  { id: "under300", label: "30만 원 이하" },
  { id: "under600", label: "30만~60만 원" },
  { id: "under1000", label: "60만~100만 원" },
  { id: "owned", label: "이미 장비가 있어요" },
];

export const MBTI_PROFILES: Record<MbtiId, MbtiProfile> = {
  ISTJ: {
    id: "ISTJ",
    nickname: "흔들리지 않는 합주 설계자",
    intro: "차곡차곡 쌓인 연습과 정확한 타이밍으로 밴드의 신뢰감을 만드는 타입입니다.",
    bandStyle: "정밀형",
    moodTags: ["정교함", "안정감", "신뢰"],
    baseScores: { vocal: 1, leadGuitar: 2, rhythmGuitar: 5, bass: 4, drums: 4, keyboard: 2 },
    positionDescriptions: {
      rhythmGuitar: "정확한 코드와 리듬으로 곡의 골격을 단단하게 세워요.",
      bass: "한 박자도 놓치지 않는 저음으로 합주의 중심을 지켜요.",
      drums: "꾸준한 그루브가 멤버 모두의 기준점이 됩니다.",
    },
  },
  ISFJ: {
    id: "ISFJ",
    nickname: "다정한 사운드 서포터",
    intro: "자신의 소리를 과하게 내세우기보다, 멤버와 곡이 가장 편안하게 빛날 자리를 만들어주는 타입입니다.",
    bandStyle: "온기형",
    moodTags: ["따뜻함", "균형", "섬세함"],
    baseScores: { vocal: 2, leadGuitar: 1, rhythmGuitar: 4, bass: 5, drums: 2, keyboard: 4 },
    positionDescriptions: {
      bass: "조용히 흐르는 저음으로 곡의 마음을 포근하게 받쳐줘요.",
      keyboard: "부드러운 화성과 패드 사운드로 무대에 온기를 더해요.",
    },
  },
  INFJ: {
    id: "INFJ",
    nickname: "서사를 그리는 무드 메이커",
    intro: "곡 한 편의 이야기와 분위기를 깊게 읽고, 소리의 여백까지 의미 있게 만드는 타입입니다.",
    bandStyle: "서사형",
    moodTags: ["몽환", "서사", "여운"],
    baseScores: { vocal: 3, leadGuitar: 2, rhythmGuitar: 2, bass: 4, drums: 1, keyboard: 5 },
    positionDescriptions: {
      keyboard: "공간감 있는 음색으로 곡의 세계관을 넓게 펼쳐요.",
      bass: "깊은 저음으로 가사 뒤의 감정까지 길게 남겨요.",
      vocal: "한 문장 한 문장에 이야기를 담아 전달해요.",
    },
  },
  INTJ: {
    id: "INTJ",
    nickname: "사운드를 설계하는 프로듀서",
    intro: "원하는 완성도를 머릿속에 그린 뒤, 필요한 소리와 구성을 정확히 찾아가는 타입입니다.",
    bandStyle: "설계형",
    moodTags: ["미래적", "집중", "완성도"],
    baseScores: { vocal: 1, leadGuitar: 5, rhythmGuitar: 3, bass: 3, drums: 2, keyboard: 5 },
    positionDescriptions: {
      keyboard: "새로운 음색과 레이어를 설계해 곡을 한 단계 확장해요.",
      leadGuitar: "계산된 톤과 솔로로 결정적인 장면을 완성해요.",
    },
  },
  ISTP: {
    id: "ISTP",
    nickname: "손끝으로 증명하는 플레이어",
    intro: "말보다 연주로 보여주며, 손에 익은 리프와 정확한 타격감에서 즐거움을 찾는 타입입니다.",
    bandStyle: "테크니컬형",
    moodTags: ["리프", "쿨함", "집중"],
    baseScores: { vocal: 1, leadGuitar: 5, rhythmGuitar: 3, bass: 4, drums: 4, keyboard: 1 },
    positionDescriptions: {
      leadGuitar: "필요한 순간 날카롭게 등장하는 리프가 무대를 바꿔요.",
      drums: "군더더기 없이 타이트한 비트로 곡을 달리게 해요.",
      bass: "손맛이 살아 있는 라인으로 그루브를 조립해요.",
    },
  },
  ISFP: {
    id: "ISFP",
    nickname: "질감을 연주하는 아티스트",
    intro: "크게 드러내지 않아도 자신만의 음색과 감각으로 무대를 아름답게 채우는 타입입니다.",
    bandStyle: "감각형",
    moodTags: ["질감", "감성", "자유"],
    baseScores: { vocal: 3, leadGuitar: 4, rhythmGuitar: 3, bass: 5, drums: 1, keyboard: 4 },
    positionDescriptions: {
      bass: "부드럽고 감각적인 저음이 곡 전체의 색을 바꿔요.",
      leadGuitar: "톤 한 음 한 음에 취향이 묻어나는 기타를 들려줘요.",
      keyboard: "예쁜 음색으로 무대에 그림 같은 장면을 만들어요.",
    },
  },
  INFP: {
    id: "INFP",
    nickname: "새벽 감성의 기록자",
    intro: "말로 설명하기 어려운 감정을 한 음과 한 문장에 담아 오래 남기는 타입입니다.",
    bandStyle: "새벽형",
    moodTags: ["새벽", "여운", "청춘"],
    baseScores: { vocal: 3, leadGuitar: 2, rhythmGuitar: 4, bass: 5, drums: 1, keyboard: 5 },
    positionDescriptions: {
      bass: "기타와 드럼 사이에서 조용히 감정선을 끌어올려요.",
      keyboard: "몽환적인 음색으로 마음속 장면을 무대 위에 꺼내요.",
      rhythmGuitar: "진심 어린 코드 진행으로 떼창의 순간을 만들어요.",
    },
  },
  INTP: {
    id: "INTP",
    nickname: "예상 밖의 소리를 탐구하는 실험가",
    intro: "익숙한 곡에서도 새로운 구조와 음색을 발견하며, 재미있는 변주를 시도하는 타입입니다.",
    bandStyle: "실험형",
    moodTags: ["변칙", "호기심", "공간감"],
    baseScores: { vocal: 1, leadGuitar: 4, rhythmGuitar: 2, bass: 4, drums: 2, keyboard: 5 },
    positionDescriptions: {
      keyboard: "신스와 이펙트로 남들이 예상하지 못한 장면을 열어요.",
      leadGuitar: "독특한 프레이즈로 곡의 공기를 뒤집어요.",
      bass: "평범하지 않은 라인이 은근히 귀를 붙잡아요.",
    },
  },
  ESTP: {
    id: "ESTP",
    nickname: "무대를 터뜨리는 액션 플레이어",
    intro: "관객의 반응을 곧바로 에너지로 바꾸고, 가장 뜨거운 순간을 직접 만드는 타입입니다.",
    bandStyle: "폭발형",
    moodTags: ["폭발", "스피드", "라이브"],
    baseScores: { vocal: 4, leadGuitar: 5, rhythmGuitar: 3, bass: 2, drums: 5, keyboard: 0 },
    positionDescriptions: {
      drums: "터지는 비트로 공연장 전체의 심장박동을 끌어올려요.",
      leadGuitar: "관객의 함성을 부르는 질주감 있는 솔로가 잘 어울려요.",
      vocal: "마이크 하나로 무대의 온도를 순식간에 올려요.",
    },
  },
  ESFP: {
    id: "ESFP",
    nickname: "빛나는 스테이지 메이커",
    intro: "무대의 즐거움을 온몸으로 표현하며, 관객과 가장 빠르게 감정을 주고받는 타입입니다.",
    bandStyle: "스타형",
    moodTags: ["반짝임", "떼창", "즐거움"],
    baseScores: { vocal: 5, leadGuitar: 4, rhythmGuitar: 2, bass: 1, drums: 4, keyboard: 2 },
    positionDescriptions: {
      vocal: "표정과 목소리만으로 관객을 한 곡 안으로 초대해요.",
      leadGuitar: "무대를 누비는 퍼포먼스와 솔로가 시선을 붙잡아요.",
    },
  },
  ENFP: {
    id: "ENFP",
    nickname: "청춘을 외치는 에너지 전파자",
    intro: "새로운 곡과 사람을 사랑하고, 벅찬 후렴을 모두의 추억으로 바꾸는 타입입니다.",
    bandStyle: "청춘형",
    moodTags: ["청춘", "낭만", "질주"],
    baseScores: { vocal: 5, leadGuitar: 3, rhythmGuitar: 4, bass: 2, drums: 3, keyboard: 4 },
    positionDescriptions: {
      vocal: "함께 따라 부르고 싶은 후렴으로 무대를 환하게 밝혀요.",
      rhythmGuitar: "달리는 코드와 밝은 에너지로 합주를 이끌어요.",
      keyboard: "컬러풀한 사운드로 매 순간 새로운 분위기를 더해요.",
    },
  },
  ENTP: {
    id: "ENTP",
    nickname: "판을 뒤집는 사운드 트릭스터",
    intro: "정해진 방식보다 재치 있는 변주와 돌발적인 아이디어로 공연의 하이라이트를 만드는 타입입니다.",
    bandStyle: "변칙형",
    moodTags: ["변주", "재치", "도발"],
    baseScores: { vocal: 4, leadGuitar: 5, rhythmGuitar: 2, bass: 3, drums: 3, keyboard: 4 },
    positionDescriptions: {
      leadGuitar: "예상하지 못한 리프와 솔로로 곡을 단숨에 뒤집어요.",
      vocal: "관객과 능청스럽게 호흡하며 공연을 놀이처럼 만들어요.",
      keyboard: "엉뚱하고 매력적인 음색으로 곡에 반전을 심어요.",
    },
  },
  ESTJ: {
    id: "ESTJ",
    nickname: "합주를 전진시키는 캡틴",
    intro: "목표가 정해지면 힘 있게 끌고 가며, 연습실과 무대 모두에서 추진력을 만드는 타입입니다.",
    bandStyle: "캡틴형",
    moodTags: ["추진력", "파워", "직진"],
    baseScores: { vocal: 3, leadGuitar: 3, rhythmGuitar: 5, bass: 4, drums: 5, keyboard: 1 },
    positionDescriptions: {
      drums: "강한 카운트와 흔들림 없는 비트가 밴드를 앞으로 달리게 해요.",
      rhythmGuitar: "단단한 스트로크로 공연의 에너지를 끝까지 유지해요.",
    },
  },
  ESFJ: {
    id: "ESFJ",
    nickname: "함께 노래하게 만드는 프런트맨",
    intro: "멤버와 관객의 표정을 살피며, 모두가 참여하는 따뜻한 무대를 만드는 타입입니다.",
    bandStyle: "공감형",
    moodTags: ["떼창", "온기", "연결"],
    baseScores: { vocal: 5, leadGuitar: 2, rhythmGuitar: 4, bass: 3, drums: 3, keyboard: 3 },
    positionDescriptions: {
      vocal: "관객 한 사람 한 사람에게 건네는 듯한 노래로 무대를 이어줘요.",
      rhythmGuitar: "함께 노래하기 좋은 코드와 리듬으로 분위기를 묶어요.",
    },
  },
  ENFJ: {
    id: "ENFJ",
    nickname: "감정을 이끄는 스토리텔러",
    intro: "노래의 메시지와 무대의 흐름을 자연스럽게 이끌며, 관객에게 강한 여운을 전하는 타입입니다.",
    bandStyle: "스토리형",
    moodTags: ["서사", "고양감", "공감"],
    baseScores: { vocal: 5, leadGuitar: 2, rhythmGuitar: 3, bass: 2, drums: 3, keyboard: 4 },
    positionDescriptions: {
      vocal: "이야기가 담긴 목소리로 후렴의 감정을 크게 확장해요.",
      keyboard: "노래를 감싸는 화성으로 무대의 감정선을 세심하게 이끌어요.",
    },
  },
  ENTJ: {
    id: "ENTJ",
    nickname: "클라이맥스를 지휘하는 리더",
    intro: "강한 목표와 존재감으로 무대를 장악하고, 공연의 절정을 확실하게 만들어내는 타입입니다.",
    bandStyle: "지휘형",
    moodTags: ["카리스마", "클라이맥스", "파워"],
    baseScores: { vocal: 5, leadGuitar: 4, rhythmGuitar: 3, bass: 2, drums: 5, keyboard: 2 },
    positionDescriptions: {
      vocal: "선명한 존재감과 힘 있는 후렴으로 무대 중심에 서요.",
      drums: "압도적인 추진력으로 공연의 클라이맥스를 몰아쳐요.",
      leadGuitar: "강렬한 리드 사운드로 곡의 승부처를 완성해요.",
    },
  },
};

export function getPositionTitle(profile: MbtiProfile, position: PositionId): string {
  return `${profile.bandStyle} ${POSITIONS[position].label}`;
}

export function getPositionDescription(profile: MbtiProfile, position: PositionId): string {
  return profile.positionDescriptions[position] ?? POSITIONS[position].baseDescription;
}
