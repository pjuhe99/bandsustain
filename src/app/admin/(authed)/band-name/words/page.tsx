import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { ALL_WORD_CATEGORIES } from "@/lib/bandName/types";
import WordsPanel from "./WordsPanel";

export const dynamic = "force-dynamic";

type WordRow = { id: number; language: string; category: string; word: string };

export default async function WordsAdminPage({
  searchParams,
}: { searchParams: Promise<{ language?: string; category?: string }> }) {
  const sp = await searchParams;
  const language = sp.language === "english" ? "english" : "korean";
  const category = ALL_WORD_CATEGORIES.includes(sp.category as never) ? sp.category! : "time";
  const [rows] = await getPool().query<(RowDataPacket & WordRow)[]>(
    "SELECT id, language, category, word FROM bandname_words WHERE language=? AND category=? ORDER BY word",
    [language, category],
  );
  return (
    <WordsPanel
      language={language}
      category={category}
      categories={ALL_WORD_CATEGORIES}
      words={rows.map((r) => ({ id: r.id, word: r.word }))}
    />
  );
}
