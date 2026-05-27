// src/lib/mbtiCasting/share.ts
// 캐스팅 결과 공유 — 6개 입력만 base64url 토큰으로 인코딩한다.
// 엔진이 결정론적이라 share 페이지/OG 이미지가 이 입력으로 결과 전체를 재계산한다.

import {
  BUDGETS, EXPERIENCES, GENRES, MBTI_PROFILES,
  SOUND_PREFERENCES, STAGE_PREFERENCES,
} from "./data";
import type { BandCastingInput } from "./engine";
import type {
  BudgetId, ExperienceId, GenreId, MbtiId, SoundPreferenceId, StagePreferenceId,
} from "./types";

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeCasting(input: BandCastingInput): string {
  return toBase64Url(JSON.stringify([
    input.mbti, input.genre, input.stagePreference,
    input.soundPreference, input.experience, input.budget,
  ]));
}

const STAGE_IDS = new Set(STAGE_PREFERENCES.map((s) => s.id));
const SOUND_IDS = new Set(SOUND_PREFERENCES.map((s) => s.id));
const EXPERIENCE_IDS = new Set(EXPERIENCES.map((e) => e.id));
const BUDGET_IDS = new Set(BUDGETS.map((b) => b.id));

export function decodeCasting(token: string): BandCastingInput | null {
  try {
    const parsed = JSON.parse(fromBase64Url(token));
    if (!Array.isArray(parsed) || parsed.length !== 6) return null;
    const [mbti, genre, stage, sound, experience, budget] = parsed;
    if (typeof mbti !== "string" || !(mbti in MBTI_PROFILES)) return null;
    if (typeof genre !== "string" || !(genre in GENRES)) return null;
    if (typeof stage !== "string" || !STAGE_IDS.has(stage as StagePreferenceId)) return null;
    if (typeof sound !== "string" || !SOUND_IDS.has(sound as SoundPreferenceId)) return null;
    if (typeof experience !== "string" || !EXPERIENCE_IDS.has(experience as ExperienceId)) return null;
    if (typeof budget !== "string" || !BUDGET_IDS.has(budget as BudgetId)) return null;
    return {
      mbti: mbti as MbtiId, genre: genre as GenreId,
      stagePreference: stage as StagePreferenceId, soundPreference: sound as SoundPreferenceId,
      experience: experience as ExperienceId, budget: budget as BudgetId,
    };
  } catch {
    return null;
  }
}
