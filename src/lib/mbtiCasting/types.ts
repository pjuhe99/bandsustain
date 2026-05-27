// src/lib/mbtiCasting/types.ts
// MBTI 밴드 캐스팅 — 공유 타입 정의. (값/데이터는 data.ts, songs.ts, gear.ts)

export type PositionId =
  | "vocal" | "leadGuitar" | "rhythmGuitar" | "bass" | "drums" | "keyboard";

export type GenreId =
  | "jPop" | "jRock" | "popPunk" | "alternative" | "indieRock" | "cityPop" | "metalHeavyRock";

export type MbtiId =
  | "ISTJ" | "ISFJ" | "INFJ" | "INTJ"
  | "ISTP" | "ISFP" | "INFP" | "INTP"
  | "ESTP" | "ESFP" | "ENFP" | "ENTP"
  | "ESTJ" | "ESFJ" | "ENFJ" | "ENTJ";

export type StagePreferenceId = "spotlight" | "signature" | "foundation" | "groove" | "texture";
export type SoundPreferenceId = "voice" | "riff" | "lowEnd" | "beat" | "synth";
export type ExperienceId = "beginner" | "starter" | "player";
export type BudgetId = "browse" | "under300" | "under600" | "under1000" | "owned";

export type PositionScores = Record<PositionId, number>;

export interface PositionDefinition {
  id: PositionId;
  label: string;
  englishLabel: string;
  icon: string;
  keyword: string;
  baseDescription: string;
}

export interface GenreDefinition {
  id: GenreId;
  label: string;
  shortDescription: string;
  positionBoosts: PositionScores;
  moodTags: string[];
}

export interface WeightedOption<T extends string> {
  id: T;
  label: string;
  positionBoosts: PositionScores;
}

export interface MbtiProfile {
  id: MbtiId;
  nickname: string;
  intro: string;
  bandStyle: string;
  moodTags: string[];
  baseScores: PositionScores;
  positionDescriptions: Partial<Record<PositionId, string>>;
}
