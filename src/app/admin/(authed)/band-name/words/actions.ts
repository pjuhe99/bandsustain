"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { ALL_WORD_CATEGORIES } from "@/lib/bandName/types";

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}
const GEN_PATH = "/playground/band-name-generator";
const categories = ALL_WORD_CATEGORIES as [string, ...string[]];

const addSchema = z.object({
  language: z.enum(["korean", "english"]),
  category: z.enum(categories),
  words: z.string().min(1),
});

export type FormState = { error?: string; ok?: string };

export async function addWords(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = addSchema.safeParse({
    language: fd.get("language"), category: fd.get("category"), words: fd.get("words"),
  });
  if (!parsed.success) return { error: "입력값을 확인해 주세요." };
  const { language, category } = parsed.data;
  const words = [...new Set(parsed.data.words.split(",").map((w) => w.trim()).filter(Boolean))]
    .filter((w) => w.length <= 64);
  if (words.length === 0) return { error: "추가할 단어가 없습니다." };
  const pool = getPool();
  for (const w of words) {
    await pool.query(
      "INSERT IGNORE INTO bandname_words (language, category, word) VALUES (?,?,?)",
      [language, category, w],
    );
  }
  revalidatePath("/admin/band-name/words");
  revalidatePath(GEN_PATH);
  return { ok: `${words.length}개 추가됨` };
}

export async function deleteWord(id: number): Promise<FormState> {
  await requireAuth();
  const pool = getPool();
  const [[row]] = await pool.query<(RowDataPacket & { language: string; category: string })[]>(
    "SELECT language, category FROM bandname_words WHERE id=?", [id]);
  if (!row) return { error: "이미 삭제됨" };
  // 삭제 가드: 이 카테고리의 마지막 단어이고, 그 카테고리를 쓰는 패턴이 있으면 차단.
  const [[cnt]] = await pool.query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) c FROM bandname_words WHERE language=? AND category=?", [row.language, row.category]);
  if (cnt.c <= 1) {
    const [pats] = await pool.query<(RowDataPacket & { slots: unknown })[]>(
      "SELECT slots FROM bandname_patterns WHERE language=?", [row.language]);
    const used = pats.some((p) => {
      const slots = Array.isArray(p.slots) ? p.slots : JSON.parse(String(p.slots));
      return (slots as string[]).includes(row.category);
    });
    if (used) return { error: `'${row.category}' 카테고리의 마지막 단어라 삭제할 수 없습니다(패턴이 사용 중).` };
  }
  await pool.query("DELETE FROM bandname_words WHERE id=?", [id]);
  revalidatePath("/admin/band-name/words");
  revalidatePath(GEN_PATH);
  return { ok: "삭제됨" };
}
