// 밴드 이름 생성기 — 타입 정의
// 외부 AI 없이 단어 DB + 패턴 + 점수화로만 동작하는 순수 로직의 계약.

export type Scene =
  | "jrock"
  | "hongdae"
  | "punk"
  | "citypop"
  | "emo"
  | "campus";

export type Mood =
  | "fresh"
  | "dreamy"
  | "wistful"
  | "funny"
  | "rough"
  | "romantic";

export type LanguageStyle = "korean" | "mixed" | "english";

export type Weirdness = 1 | 2 | 3 | 4 | 5;

export type BandNameInput = {
  scene: Scene;
  mood: Mood;
  language: LanguageStyle;
  weirdness: Weirdness;
};

export type WordCategory =
  | "time"
  | "season"
  | "weather"
  | "color"
  | "light"
  | "place"
  | "city"
  | "room"
  | "analog"
  | "sound"
  | "nature"
  | "emotion"
  | "youth"
  | "machine"
  | "movement"
  | "odd"
  | "food"
  | "suffix";

// 패턴은 언어별 목록으로 분리해서 들고 있으므로 language 배열 필드는 두지 않는다.
// 혼합(mixed)은 한국어 패턴을 런타임에 차용하며 첫 슬롯만 영어로 채운다.
export type Pattern = {
  id: string;
  slots: WordCategory[];
  separator: string;
  scenes: Scene[];
  moods: Mood[];
  minWeirdness: Weirdness;
  maxWeirdness: Weirdness;
  weight: number;
};

export type GeneratedBandName = {
  name: string;
  scene: Scene;
  mood: Mood;
  patternId: string;
  score: number;
  tags: string[];
  usedWords: string[];
};

// 슬롯별 단어를 어느 언어 DB에서 뽑을지 결정하는 내부용 보조 타입.
export type SlotLanguage = "korean" | "english";
