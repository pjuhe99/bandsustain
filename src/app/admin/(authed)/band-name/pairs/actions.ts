"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

async function requireAuth() { if (!(await readSession())) throw new Error("UNAUTHENTICATED"); }
const GEN_PATH = "/playground/band-name-generator";
const schema = z.object({
  kind: z.enum(["preferred", "blocked"]),
  wordA: z.string().min(1).max(64),
  wordB: z.string().min(1).max(64),
});
export type FormState = { error?: string; ok?: string };

export async function addPair(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = schema.safeParse({ kind: fd.get("kind"), wordA: fd.get("wordA"), wordB: fd.get("wordB") });
  if (!r.success) return { error: "입력값을 확인해 주세요." };
  const { kind, wordA, wordB } = r.data;
  await getPool().query(
    "INSERT IGNORE INTO bandname_pairs (kind, word_a, word_b) VALUES (?,?,?)",
    [kind, wordA.trim(), wordB.trim()],
  );
  revalidatePath("/admin/band-name/pairs");
  revalidatePath(GEN_PATH);
  return { ok: "추가됨" };
}

export async function deletePair(id: number): Promise<void> {
  await requireAuth();
  await getPool().query("DELETE FROM bandname_pairs WHERE id=?", [id]);
  revalidatePath("/admin/band-name/pairs");
  revalidatePath(GEN_PATH);
}
