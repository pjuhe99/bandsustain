// src/lib/bandName/dataset.ts
// rowsToDataset: pure mapper (DB rows → BandNameDataset) — importable from tests.
// loadBandNameDataset: server-only loader (dynamically imports @/lib/db which is server-only)
//   → returns defaultDataset if bandname_words is empty or on any error.
//
// NOTE: @/lib/db has `import "server-only"` which throws in non-RSC contexts.
// To keep rowsToDataset unit-testable, getPool is loaded lazily inside loadBandNameDataset
// via dynamic import — the pure mapper and type definitions at the top of this file are
// importable from node:test without triggering the server-only guard.
import type { RowDataPacket } from "mysql2";
import { defaultDataset } from "./data";
import type {
  BandNameDataset, Mood, Pattern, Scene, Weirdness, WordCategory, WordMap,
} from "./types";

type WordRow = { language: "korean" | "english"; category: string; word: string };
type PatternRow = {
  pattern_key: string; language: "korean" | "english";
  slots: unknown; scenes: unknown; moods: unknown; separator: string;
  min_weirdness: number; max_weirdness: number; weight: number;
};
type PairRow = { kind: "preferred" | "blocked"; word_a: string; word_b: string };
type NameRow = { name: string };

function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    try { const p = JSON.parse(v); return Array.isArray(p) ? (p as T[]) : []; } catch { return []; }
  }
  return [];
}

export function rowsToDataset(
  words: WordRow[], patterns: PatternRow[], pairs: PairRow[], names: NameRow[],
): BandNameDataset {
  const koreanWords: WordMap = {};
  const englishWords: WordMap = {};
  for (const r of words) {
    const map = r.language === "english" ? englishWords : koreanWords;
    (map[r.category as WordCategory] ??= []).push(r.word);
  }

  const toPatterns = (lang: "korean" | "english"): Pattern[] =>
    patterns.filter((p) => p.language === lang).map((r) => ({
      id: r.pattern_key,
      slots: asArray<WordCategory>(r.slots),
      separator: r.separator,
      scenes: asArray<Scene>(r.scenes),
      moods: asArray<Mood>(r.moods),
      minWeirdness: r.min_weirdness as Weirdness,
      maxWeirdness: r.max_weirdness as Weirdness,
      weight: r.weight,
    }));

  return {
    koreanWords,
    englishWords,
    koreanPatterns: toPatterns("korean"),
    englishPatterns: toPatterns("english"),
    preferredPairs: pairs.filter((p) => p.kind === "preferred").map((p) => [p.word_a, p.word_b]),
    blockedPairs: pairs.filter((p) => p.kind === "blocked").map((p) => [p.word_a, p.word_b]),
    blockedExactNames: new Set(names.map((n) => n.name)),
  };
}

// DB 에서 전체 데이터셋 로드. 비었거나 오류 시 defaultDataset 폴백.
// @/lib/db 는 server-only → 이 함수는 서버 컨텍스트(RSC/Server Action)에서만 호출할 것.
export async function loadBandNameDataset(): Promise<BandNameDataset> {
  try {
    const { getPool } = await import("@/lib/db");
    const pool = getPool();
    const [w] = await pool.query<(RowDataPacket & WordRow)[]>(
      "SELECT language, category, word FROM bandname_words");
    if (w.length === 0) return defaultDataset;
    const [p] = await pool.query<(RowDataPacket & PatternRow)[]>(
      "SELECT pattern_key, language, slots, scenes, moods, `separator`, min_weirdness, max_weirdness, weight FROM bandname_patterns");
    const [pr] = await pool.query<(RowDataPacket & PairRow)[]>(
      "SELECT kind, word_a, word_b FROM bandname_pairs");
    const [n] = await pool.query<(RowDataPacket & NameRow)[]>(
      "SELECT name FROM bandname_blocked_names");
    return rowsToDataset(w, p, pr, n);
  } catch {
    return defaultDataset;
  }
}
