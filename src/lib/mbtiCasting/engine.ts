// src/lib/mbtiCasting/engine.ts
import {
  GENRES, MBTI_PROFILES, POSITIONS, POSITION_PRIORITY,
  SOUND_PREFERENCES, STAGE_PREFERENCES,
  getPositionDescription, getPositionTitle,
} from "./data";
import type {
  BudgetId, ExperienceId, GenreId, MbtiId, PositionId,
  PositionScores, SoundPreferenceId, StagePreferenceId,
} from "./types";
import {
  DIFFICULTY_LABELS, EXPERIENCE_DIFFICULTY_PREFERENCE, SONGS,
  type SongRecommendation,
} from "./songs";
import { GENRE_GEAR_TIPS, GEAR_NOTICE, getGearBundle } from "./gear";

export interface BandCastingInput {
  mbti: MbtiId;
  genre: GenreId;
  stagePreference: StagePreferenceId;
  soundPreference: SoundPreferenceId;
  experience: ExperienceId;
  budget: BudgetId;
}

export interface ScoredPosition {
  id: PositionId;
  score: number;
}

export interface DisplaySong extends SongRecommendation {
  reason: string;
  difficultyLabel: string;
}

export interface BandCastingResult {
  input: BandCastingInput;
  primaryPosition: PositionId;
  secondaryPosition: PositionId;
  title: string;
  description: string;
  intro: string;
  moodTags: string[];
  songs: DisplaySong[];
  gear: {
    items: { category: string; name: string; reason: string }[];
    guide: string;
    genreTip?: string;
    notice: string;
  };
  nameGeneratorPayload: {
    mbti: MbtiId;
    genre: GenreId;
    position: PositionId;
    mood: string[];
  };
  disclaimer: string;
}

function addScores(...scoreGroups: PositionScores[]): PositionScores {
  const result: PositionScores = {
    vocal: 0,
    leadGuitar: 0,
    rhythmGuitar: 0,
    bass: 0,
    drums: 0,
    keyboard: 0,
  };
  for (const group of scoreGroups) {
    for (const position of POSITION_PRIORITY) {
      result[position] += group[position] ?? 0;
    }
  }
  return result;
}

function rankPositions(scores: PositionScores): ScoredPosition[] {
  return POSITION_PRIORITY
    .map((id) => ({ id, score: scores[id] }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return POSITION_PRIORITY.indexOf(a.id) - POSITION_PRIORITY.indexOf(b.id);
    });
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function scoreSong(
  song: SongRecommendation,
  input: BandCastingInput,
  primaryPosition: PositionId,
  moodTags: string[],
): number {
  let score = 0;
  if (song.genre === input.genre) score += 10;
  if (song.spotlightPositions.includes(primaryPosition)) score += 5;

  score += song.moodTags.filter((tag) => moodTags.includes(tag)).length * 2;

  const preferredDifficulty = EXPERIENCE_DIFFICULTY_PREFERENCE[input.experience];
  const difficultyIndex = preferredDifficulty.indexOf(song.difficulty);
  score += difficultyIndex === 0 ? 3 : difficultyIndex === 1 ? 1 : 0;

  return score;
}

function getSongReason(song: SongRecommendation, position: PositionId): string {
  return (
    song.reasonByPosition?.[position] ??
    `${POSITIONS[position].label} 사운드가 곡의 분위기와 자연스럽게 어울리는 커버곡이에요.`
  );
}

function pickSongs(
  input: BandCastingInput,
  primaryPosition: PositionId,
  moodTags: string[],
): DisplaySong[] {
  const ranked = [...SONGS]
    .map((song) => ({
      song,
      score: scoreSong(song, input, primaryPosition, moodTags),
    }))
    .sort((a, b) => b.score - a.score || a.song.id.localeCompare(b.song.id));

  // 장르 곡이 3개 이상 제공되는 현재 DB에서는 선택 장르의 곡만 노출한다.
  // 추후 특정 장르 데이터가 부족해지면 전체 ranked fallback이 동작한다.
  const sameGenre = ranked.filter(({ song }) => song.genre === input.genre);
  const selection = (sameGenre.length >= 3 ? sameGenre : ranked).slice(0, 3);

  return selection.map(({ song }) => ({
    ...song,
    reason: getSongReason(song, primaryPosition),
    difficultyLabel: DIFFICULTY_LABELS[song.difficulty],
  }));
}

export function recommendBandCasting(input: BandCastingInput): BandCastingResult {
  const profile = MBTI_PROFILES[input.mbti];
  const genre = GENRES[input.genre];
  const stage = STAGE_PREFERENCES.find((item) => item.id === input.stagePreference);
  const sound = SOUND_PREFERENCES.find((item) => item.id === input.soundPreference);

  if (!stage || !sound) {
    throw new Error("Invalid stage or sound preference input.");
  }

  const totalScores = addScores(
    profile.baseScores,
    genre.positionBoosts,
    stage.positionBoosts,
    sound.positionBoosts,
  );

  const ranking = rankPositions(totalScores);
  const primaryPosition = ranking[0].id;
  const secondaryPosition = ranking[1].id;
  const moodTags = unique([...profile.moodTags, ...genre.moodTags]).slice(0, 3);
  const gearBundle = getGearBundle(primaryPosition, input.budget);

  return {
    input,
    primaryPosition,
    secondaryPosition,
    title: getPositionTitle(profile, primaryPosition),
    intro: profile.nickname,
    description: getPositionDescription(profile, primaryPosition),
    moodTags,
    songs: pickSongs(input, primaryPosition, moodTags),
    gear: {
      items: gearBundle.items,
      guide: gearBundle.guide,
      genreTip: GENRE_GEAR_TIPS[input.genre]?.[primaryPosition],
      notice: GEAR_NOTICE,
    },
    nameGeneratorPayload: {
      mbti: input.mbti,
      genre: input.genre,
      position: primaryPosition,
      mood: moodTags,
    },
    disclaimer:
      "MBTI는 재미를 위한 힌트로만 활용했어요. 실제 포지션은 좋아하는 소리와 연주 경험에 따라 달라질 수 있어요.",
  };
}
