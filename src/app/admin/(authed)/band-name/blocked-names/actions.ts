"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

async function requireAuth() { if (!(await readSession())) throw new Error("UNAUTHENTICATED"); }
const GEN_PATH = "/playground/band-name-generator";
const schema = z.object({ name: z.string().min(1).max(128) });
export type FormState = { error?: string; ok?: string };

export async function addBlockedName(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = schema.safeParse({ name: fd.get("name") });
  if (!r.success) return { error: "1–128자" };
  await getPool().query("INSERT IGNORE INTO bandname_blocked_names (name) VALUES (?)", [r.data.name.trim()]);
  revalidatePath("/admin/band-name/blocked-names");
  revalidatePath(GEN_PATH);
  return { ok: "추가됨" };
}

export async function deleteBlockedName(id: number): Promise<void> {
  await requireAuth();
  await getPool().query("DELETE FROM bandname_blocked_names WHERE id=?", [id]);
  revalidatePath("/admin/band-name/blocked-names");
  revalidatePath(GEN_PATH);
}
