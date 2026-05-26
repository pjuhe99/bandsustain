import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { ALL_WORD_CATEGORIES } from "@/lib/bandName/types";
import { sceneLabels } from "@/lib/bandName/data";
import { deriveSceneCategories } from "@/lib/bandName/sceneCategories";
import WordsPanel from "./WordsPanel";

export const dynamic = "force-dynamic";

type WordRow = { id: number; language: string; category: string; word: string };
type PatternRow = { scenes: unknown; slots: unknown };

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? (v as string[]) : typeof v === "string" ? JSON.parse(v) : [];

export default async function WordsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ language?: string; scene?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const language = sp.language === "english" ? "english" : "korean";

  // 패턴에서 씬 → 카테고리 매핑 파생 (관리자가 추가한 패턴까지 반영).
  const pool = getPool();
  const [patternRows] = await pool.query<(RowDataPacket & PatternRow)[]>(
    "SELECT scenes, slots FROM bandname_patterns",
  );
  const sceneCategories = deriveSceneCategories(
    patternRows.map((r) => ({ scenes: asArray(r.scenes), slots: asArray(r.slots) })),
  );

  // 장르 필터: "all" 이면 전체 카테고리, 특정 씬이면 그 씬이 쓰는 카테고리만.
  const sceneOptions = [
    { value: "all", label: "전체 장르" },
    ...(Object.keys(sceneLabels) as (keyof typeof sceneLabels)[]).map((s) => ({
      value: s,
      label: sceneLabels[s],
    })),
  ];
  const scene = sceneOptions.some((o) => o.value === sp.scene) ? sp.scene! : "all";
  const availableCategories =
    scene === "all" ? ALL_WORD_CATEGORIES : sceneCategories[scene] ?? [];

  // 선택 카테고리 검증: 현재 장르에서 유효하지 않으면 첫 번째로 폴백.
  const category =
    sp.category && availableCategories.includes(sp.category)
      ? sp.category
      : availableCategories[0] ?? "time";

  const [rows] = await pool.query<(RowDataPacket & WordRow)[]>(
    "SELECT id, language, category, word FROM bandname_words WHERE language=? AND category=? ORDER BY word",
    [language, category],
  );

  return (
    <WordsPanel
      language={language}
      scene={scene}
      category={category}
      sceneOptions={sceneOptions}
      categories={availableCategories}
      words={rows.map((r) => ({ id: r.id, word: r.word }))}
    />
  );
}
