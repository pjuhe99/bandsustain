// src/lib/mbtiCasting/songs.ts
import type { ExperienceId, GenreId, PositionId } from "./types";

export type DifficultyId = "easy" | "medium" | "challenging";

export interface SongRecommendation {
  id: string;
  title: string;
  artist: string;
  genre: GenreId;
  moodTags: string[];
  spotlightPositions: PositionId[];
  difficulty: DifficultyId;
  reasonByPosition?: Partial<Record<PositionId, string>>;
}

export const DIFFICULTY_LABELS: Record<DifficultyId, string> = {
  easy: "입문 도전",
  medium: "합주 도전",
  challenging: "실력 업",
};

export const EXPERIENCE_DIFFICULTY_PREFERENCE: Record<ExperienceId, DifficultyId[]> = {
  beginner: ["easy", "medium", "challenging"],
  starter: ["medium", "easy", "challenging"],
  player: ["challenging", "medium", "easy"],
};

// 곡 제목/아티스트 기반의 큐레이션 DB입니다.
// 서비스 노출 전 곡 표기, 제공 국가, 저작권/외부 링크 정책은 운영 기준에 맞춰 확인하세요.
export const SONGS: SongRecommendation[] = [
  // J-POP
  {
    id: "jpop-yoasobi-yorunikakeru",
    title: "夜に駆ける",
    artist: "YOASOBI",
    genre: "jPop",
    moodTags: ["컬러풀", "야경", "질주"],
    spotlightPositions: ["vocal", "keyboard", "bass"],
    difficulty: "medium",
    reasonByPosition: {
      vocal: "빠르게 흐르는 멜로디와 감정의 고조를 표현해 보기 좋아요.",
      keyboard: "반짝이는 리듬과 레이어를 살려 곡의 속도감을 만들 수 있어요.",
      bass: "달리는 곡 아래에서 탄탄한 흐름을 받쳐주는 재미가 있어요.",
    },
  },
  {
    id: "jpop-yorushika-tadakiminihare",
    title: "ただ君に晴れ",
    artist: "ヨルシカ",
    genre: "jPop",
    moodTags: ["청량", "여름", "여운"],
    spotlightPositions: ["vocal", "leadGuitar", "rhythmGuitar"],
    difficulty: "medium",
    reasonByPosition: {
      leadGuitar: "맑게 튀는 기타 라인으로 청량한 장면을 만들 수 있어요.",
      rhythmGuitar: "가볍게 달리는 코드가 곡의 여름 감성을 살려줘요.",
    },
  },
  {
    id: "jpop-officialhigedandism-pretender",
    title: "Pretender",
    artist: "Official髭男dism",
    genre: "jPop",
    moodTags: ["서사", "멜로디", "여운"],
    spotlightPositions: ["vocal", "keyboard", "bass"],
    difficulty: "challenging",
    reasonByPosition: {
      vocal: "감정이 점점 커지는 후렴을 이야기하듯 전달하기 좋아요.",
      keyboard: "곡의 풍성한 화성과 전개를 주도해 볼 수 있어요.",
    },
  },
  {
    id: "jpop-aimer-kataomoi",
    title: "カタオモイ",
    artist: "Aimer",
    genre: "jPop",
    moodTags: ["따뜻함", "감성", "여운"],
    spotlightPositions: ["vocal", "rhythmGuitar", "keyboard"],
    difficulty: "easy",
    reasonByPosition: {
      vocal: "섬세한 목소리와 감정 전달에 집중하기 좋은 곡이에요.",
      rhythmGuitar: "담백한 반주로 노래를 포근하게 감쌀 수 있어요.",
    },
  },
  {
    id: "jpop-kenshi-yonezu-lemon",
    title: "Lemon",
    artist: "米津玄師",
    genre: "jPop",
    moodTags: ["서사", "잔상", "감성"],
    spotlightPositions: ["vocal", "keyboard", "bass"],
    difficulty: "medium",
    reasonByPosition: {
      vocal: "차분한 시작부터 큰 여운까지 표현하는 재미가 있어요.",
      keyboard: "정서적인 화성으로 곡의 잔상을 길게 남길 수 있어요.",
    },
  },

  // J-ROCK
  {
    id: "jrock-kana-boon-silhouette",
    title: "シルエット",
    artist: "KANA-BOON",
    genre: "jRock",
    moodTags: ["청춘", "질주", "떼창"],
    spotlightPositions: ["vocal", "rhythmGuitar", "bass", "drums"],
    difficulty: "medium",
    reasonByPosition: {
      bass: "끊임없이 앞으로 달리는 저음으로 곡의 추진력을 느낄 수 있어요.",
      drums: "힘 있는 비트로 후렴의 벅참을 밀어 올리기 좋아요.",
      rhythmGuitar: "시원한 스트로크로 청춘 록의 에너지를 만들 수 있어요.",
    },
  },
  {
    id: "jrock-kessoku-distortion",
    title: "Distortion!!",
    artist: "結束バンド",
    genre: "jRock",
    moodTags: ["청춘", "반짝임", "질주"],
    spotlightPositions: ["vocal", "leadGuitar", "rhythmGuitar", "bass"],
    difficulty: "medium",
    reasonByPosition: {
      leadGuitar: "선명한 기타 톤과 밴드 사운드가 돋보이는 곡이에요.",
      bass: "밝고 힘찬 합주 속에서 저음의 존재감을 느껴볼 수 있어요.",
    },
  },
  {
    id: "jrock-radwimps-zenzenzense",
    title: "前前前世",
    artist: "RADWIMPS",
    genre: "jRock",
    moodTags: ["질주", "서사", "벅참"],
    spotlightPositions: ["vocal", "rhythmGuitar", "drums"],
    difficulty: "medium",
    reasonByPosition: {
      drums: "곡을 단숨에 끌고 가는 에너지 있는 리듬이 매력적이에요.",
      vocal: "속도감 있는 가사와 터지는 후렴으로 무대감을 느낄 수 있어요.",
    },
  },
  {
    id: "jrock-oneokrock-thebeginning",
    title: "The Beginning",
    artist: "ONE OK ROCK",
    genre: "jRock",
    moodTags: ["강렬", "클라이맥스", "라이브"],
    spotlightPositions: ["vocal", "leadGuitar", "drums"],
    difficulty: "challenging",
    reasonByPosition: {
      vocal: "힘 있는 보컬로 공연의 클라이맥스를 만들어 보기 좋아요.",
      leadGuitar: "두터운 기타 사운드와 강한 전개를 살릴 수 있어요.",
    },
  },
  {
    id: "jrock-ajikan-rere",
    title: "Re:Re:",
    artist: "ASIAN KUNG-FU GENERATION",
    genre: "jRock",
    moodTags: ["잔상", "청춘", "기타"],
    spotlightPositions: ["leadGuitar", "rhythmGuitar", "bass"],
    difficulty: "medium",
    reasonByPosition: {
      leadGuitar: "반복되는 기타 모티프가 곡의 감정을 서서히 키워줘요.",
      rhythmGuitar: "단단한 밴드 앙상블의 맛을 느끼기 좋은 곡이에요.",
    },
  },

  // POP PUNK
  {
    id: "poppunk-greenday-basketcase",
    title: "Basket Case",
    artist: "Green Day",
    genre: "popPunk",
    moodTags: ["직진", "속도감", "떼창"],
    spotlightPositions: ["vocal", "rhythmGuitar", "bass", "drums"],
    difficulty: "easy",
    reasonByPosition: {
      rhythmGuitar: "빠른 파워코드 스트로크로 팝펑크의 핵심을 경험하기 좋아요.",
      drums: "단순하고 신나는 비트로 첫 합주에 잘 어울려요.",
    },
  },
  {
    id: "poppunk-blink182-allthesmallthings",
    title: "All the Small Things",
    artist: "blink-182",
    genre: "popPunk",
    moodTags: ["떼창", "유쾌", "여름"],
    spotlightPositions: ["vocal", "rhythmGuitar", "drums"],
    difficulty: "easy",
    reasonByPosition: {
      vocal: "관객과 함께 따라 부르기 좋은 후렴이 매력적이에요.",
      rhythmGuitar: "간결한 코드로 무대 에너지를 빠르게 만들 수 있어요.",
    },
  },
  {
    id: "poppunk-avril-sk8erboi",
    title: "Sk8er Boi",
    artist: "Avril Lavigne",
    genre: "popPunk",
    moodTags: ["반항", "청춘", "스피드"],
    spotlightPositions: ["vocal", "rhythmGuitar", "drums"],
    difficulty: "easy",
    reasonByPosition: {
      vocal: "캐릭터 있는 보컬 표현과 신나는 무대 제스처를 살리기 좋아요.",
    },
  },
  {
    id: "poppunk-paramore-miserybusiness",
    title: "Misery Business",
    artist: "Paramore",
    genre: "popPunk",
    moodTags: ["폭발", "카리스마", "질주"],
    spotlightPositions: ["vocal", "leadGuitar", "drums"],
    difficulty: "challenging",
    reasonByPosition: {
      vocal: "강한 보컬 에너지와 무대 존재감을 시험해 볼 수 있어요.",
      drums: "폭발적인 리듬으로 공연 전체를 달아오르게 해요.",
    },
  },
  {
    id: "poppunk-sum41-fatlip",
    title: "Fat Lip",
    artist: "Sum 41",
    genre: "popPunk",
    moodTags: ["반항", "재치", "폭발"],
    spotlightPositions: ["vocal", "leadGuitar", "rhythmGuitar", "drums"],
    difficulty: "medium",
    reasonByPosition: {
      leadGuitar: "펑크 에너지와 록 리프를 함께 살려볼 수 있어요.",
    },
  },

  // ALTERNATIVE
  {
    id: "alternative-radiohead-creep",
    title: "Creep",
    artist: "Radiohead",
    genre: "alternative",
    moodTags: ["잔상", "서사", "폭발"],
    spotlightPositions: ["vocal", "leadGuitar", "bass"],
    difficulty: "easy",
    reasonByPosition: {
      vocal: "조용한 감정이 후렴에서 크게 터지는 흐름을 표현하기 좋아요.",
      leadGuitar: "곡의 전환을 알리는 강렬한 기타 질감을 살릴 수 있어요.",
    },
  },
  {
    id: "alternative-nirvana-smellsliketeenspirit",
    title: "Smells Like Teen Spirit",
    artist: "Nirvana",
    genre: "alternative",
    moodTags: ["거침", "청춘", "폭발"],
    spotlightPositions: ["vocal", "leadGuitar", "rhythmGuitar", "drums"],
    difficulty: "easy",
    reasonByPosition: {
      drums: "단단하고 큰 비트로 합주의 에너지를 확 끌어올릴 수 있어요.",
      rhythmGuitar: "거친 디스토션 코드로 얼터너티브 록의 맛을 느껴요.",
    },
  },
  {
    id: "alternative-killers-mrbrightside",
    title: "Mr. Brightside",
    artist: "The Killers",
    genre: "alternative",
    moodTags: ["질주", "떼창", "야경"],
    spotlightPositions: ["vocal", "leadGuitar", "drums", "keyboard"],
    difficulty: "medium",
    reasonByPosition: {
      leadGuitar: "반복되며 질주하는 기타 패턴이 곡의 긴장감을 만들어요.",
      keyboard: "밴드 사운드 뒤의 반짝이는 결을 더해줄 수 있어요.",
    },
  },
  {
    id: "alternative-arcticmonkeys-doiwannaknow",
    title: "Do I Wanna Know?",
    artist: "Arctic Monkeys",
    genre: "alternative",
    moodTags: ["중량감", "야경", "그루브"],
    spotlightPositions: ["leadGuitar", "bass", "drums", "vocal"],
    difficulty: "easy",
    reasonByPosition: {
      bass: "묵직한 리프와 여유 있는 그루브를 깊게 느껴볼 수 있어요.",
      leadGuitar: "기억에 남는 메인 리프로 무대의 분위기를 지배해요.",
    },
  },
  {
    id: "alternative-muse-starlight",
    title: "Starlight",
    artist: "Muse",
    genre: "alternative",
    moodTags: ["서사", "반짝임", "클라이맥스"],
    spotlightPositions: ["vocal", "bass", "keyboard", "drums"],
    difficulty: "medium",
    reasonByPosition: {
      bass: "선명하게 움직이는 베이스 라인이 곡의 인상을 주도해요.",
      keyboard: "웅장한 공간감을 추가해 무대의 크기를 넓혀요.",
    },
  },

  // INDIE ROCK
  {
    id: "indie-strokes-lastnite",
    title: "Last Nite",
    artist: "The Strokes",
    genre: "indieRock",
    moodTags: ["쿨함", "취향", "기타"],
    spotlightPositions: ["vocal", "leadGuitar", "rhythmGuitar", "bass"],
    difficulty: "easy",
    reasonByPosition: {
      rhythmGuitar: "담백하고 스타일 있는 스트로크 톤을 연습하기 좋아요.",
      bass: "기타 사이에서 경쾌하게 걸어가는 라인을 느낄 수 있어요.",
    },
  },
  {
    id: "indie-hyukoh-comesandgoes",
    title: "Comes And Goes",
    artist: "HYUKOH",
    genre: "indieRock",
    moodTags: ["산책", "나른함", "그루브"],
    spotlightPositions: ["vocal", "bass", "rhythmGuitar"],
    difficulty: "medium",
    reasonByPosition: {
      bass: "여유 있는 그루브가 곡의 온도와 분위기를 결정해요.",
      vocal: "담백하고 개성 있는 보컬 컬러를 살려보기 좋아요.",
    },
  },
  {
    id: "indie-blackskirts-everything",
    title: "EVERYTHING",
    artist: "검정치마",
    genre: "indieRock",
    moodTags: ["새벽", "감성", "여운"],
    spotlightPositions: ["vocal", "rhythmGuitar", "keyboard"],
    difficulty: "easy",
    reasonByPosition: {
      vocal: "과한 기교보다 솔직한 감정을 담아 부르기 좋은 곡이에요.",
      keyboard: "은은한 사운드로 곡의 여백을 채우기 좋아요.",
    },
  },
  {
    id: "indie-wavetoearth-bad",
    title: "bad",
    artist: "wave to earth",
    genre: "indieRock",
    moodTags: ["질감", "나른함", "야경"],
    spotlightPositions: ["vocal", "leadGuitar", "bass", "keyboard"],
    difficulty: "medium",
    reasonByPosition: {
      leadGuitar: "부드러운 톤과 공간감 있는 연주로 취향을 보여줄 수 있어요.",
      bass: "편안하게 흐르는 저음으로 전체 무드를 잡아줘요.",
    },
  },
  {
    id: "indie-dayglow-canicallyoutonight",
    title: "Can I Call You Tonight?",
    artist: "Dayglow",
    genre: "indieRock",
    moodTags: ["청량", "반짝임", "취향"],
    spotlightPositions: ["vocal", "leadGuitar", "keyboard"],
    difficulty: "medium",
    reasonByPosition: {
      keyboard: "밝고 레트로한 색채를 더해 무대 분위기를 살릴 수 있어요.",
    },
  },

  // CITY POP
  {
    id: "citypop-miki-mayonakano-door",
    title: "真夜中のドア〜Stay With Me",
    artist: "松原みき",
    genre: "cityPop",
    moodTags: ["야경", "네온", "그루브"],
    spotlightPositions: ["vocal", "bass", "keyboard", "leadGuitar"],
    difficulty: "medium",
    reasonByPosition: {
      bass: "매끄럽게 움직이는 저음이 시티팝의 세련된 밤공기를 만들어요.",
      keyboard: "화성과 음색으로 네온 같은 분위기를 더하기 좋아요.",
    },
  },
  {
    id: "citypop-mariya-plasticlove",
    title: "Plastic Love",
    artist: "竹内まりや",
    genre: "cityPop",
    moodTags: ["야경", "그루브", "세련됨"],
    spotlightPositions: ["vocal", "bass", "keyboard", "rhythmGuitar"],
    difficulty: "challenging",
    reasonByPosition: {
      bass: "곡을 이끄는 세련된 그루브를 제대로 경험할 수 있어요.",
      rhythmGuitar: "깔끔한 커팅 연주로 도회적인 리듬을 만들어요.",
    },
  },
  {
    id: "citypop-suchmos-staytune",
    title: "STAY TUNE",
    artist: "Suchmos",
    genre: "cityPop",
    moodTags: ["그루브", "쿨함", "도시"],
    spotlightPositions: ["vocal", "bass", "drums", "keyboard"],
    difficulty: "medium",
    reasonByPosition: {
      drums: "힘을 빼고도 몸이 움직이는 그루브를 연주해 볼 수 있어요.",
      bass: "리듬 섹션의 존재감이 큰 곡이라 베이스의 재미가 분명해요.",
    },
  },
  {
    id: "citypop-anri-remember-summer-days",
    title: "Remember Summer Days",
    artist: "杏里",
    genre: "cityPop",
    moodTags: ["여름", "네온", "반짝임"],
    spotlightPositions: ["vocal", "bass", "keyboard"],
    difficulty: "medium",
    reasonByPosition: {
      keyboard: "레트로한 키보드 색채로 여름밤 분위기를 구현하기 좋아요.",
    },
  },
  {
    id: "citypop-prep-cheapestflight",
    title: "Cheapest Flight",
    artist: "PREP",
    genre: "cityPop",
    moodTags: ["세련됨", "야경", "질감"],
    spotlightPositions: ["vocal", "bass", "keyboard", "leadGuitar"],
    difficulty: "medium",
    reasonByPosition: {
      leadGuitar: "클린 톤과 섬세한 프레이즈로 공간감 있는 연주를 즐길 수 있어요.",
    },
  },

  // METAL / HEAVY ROCK
  {
    id: "metal-metallica-entersandman",
    title: "Enter Sandman",
    artist: "Metallica",
    genre: "metalHeavyRock",
    moodTags: ["중량감", "리프", "강렬"],
    spotlightPositions: ["leadGuitar", "rhythmGuitar", "bass", "drums"],
    difficulty: "medium",
    reasonByPosition: {
      rhythmGuitar: "묵직한 메인 리프로 헤비한 사운드의 핵심을 느낄 수 있어요.",
      drums: "큰 박자와 강한 타격으로 곡의 압도감을 받쳐줘요.",
    },
  },
  {
    id: "metal-linkinpark-faint",
    title: "Faint",
    artist: "Linkin Park",
    genre: "metalHeavyRock",
    moodTags: ["폭발", "속도감", "클라이맥스"],
    spotlightPositions: ["vocal", "rhythmGuitar", "drums", "keyboard"],
    difficulty: "medium",
    reasonByPosition: {
      vocal: "쉴 틈 없는 긴장감과 폭발적인 후렴을 전달하기 좋아요.",
      drums: "빠르고 단단한 비트가 곡 전체의 에너지를 결정해요.",
      keyboard: "전자적 레이어로 강렬한 록 사운드에 색을 더해요.",
    },
  },
  {
    id: "metal-soad-chopsuey",
    title: "Chop Suey!",
    artist: "System Of A Down",
    genre: "metalHeavyRock",
    moodTags: ["변칙", "폭발", "강렬"],
    spotlightPositions: ["vocal", "leadGuitar", "drums"],
    difficulty: "challenging",
    reasonByPosition: {
      vocal: "극적인 변화와 강한 표현력을 무대에서 펼쳐보기 좋아요.",
      drums: "급격한 전개 변화를 따라가며 에너지 넘치는 연주를 할 수 있어요.",
    },
  },
  {
    id: "metal-evanescence-bringmetolife",
    title: "Bring Me To Life",
    artist: "Evanescence",
    genre: "metalHeavyRock",
    moodTags: ["서사", "폭발", "어둠"],
    spotlightPositions: ["vocal", "leadGuitar", "keyboard", "drums"],
    difficulty: "challenging",
    reasonByPosition: {
      vocal: "극적인 감정선과 강한 클라이맥스를 보여줄 수 있어요.",
      keyboard: "어두운 무드와 웅장한 레이어를 만들어내기 좋아요.",
    },
  },
  {
    id: "metal-babymetal-gimmechocolate",
    title: "ギミチョコ!!",
    artist: "BABYMETAL",
    genre: "metalHeavyRock",
    moodTags: ["반전", "스피드", "유쾌"],
    spotlightPositions: ["vocal", "leadGuitar", "rhythmGuitar", "drums"],
    difficulty: "challenging",
    reasonByPosition: {
      leadGuitar: "빠르고 화려한 메탈 사운드로 강한 퍼포먼스를 펼칠 수 있어요.",
      drums: "높은 에너지를 유지하며 무대를 몰아붙이는 재미가 있어요.",
    },
  },
];
