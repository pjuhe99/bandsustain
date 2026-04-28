"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

const songSchema = z.object({
  title: z.string().min(1).max(255),
  category: z.enum(["Album", "EP", "Single", "Live Session"]),
  artworkUrl: z.string().min(1).max(255),
  listenUrl: z.string().max(500).optional().or(z.literal("")),
  lyrics: z.string().optional().or(z.literal("")),
  releasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다"),
});

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}

function fromForm(fd: FormData) {
  return {
    title: fd.get("title"),
    category: fd.get("category"),
    artworkUrl: fd.get("artworkUrl"),
    listenUrl: fd.get("listenUrl") ?? "",
    lyrics: fd.get("lyrics") ?? "",
    releasedAt: fd.get("releasedAt"),
  };
}

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createSong(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = songSchema.safeParse(fromForm(fd));
  if (!r.success) {
    const fe: Record<string, string> = {};
    for (const issue of r.error.issues) fe[issue.path.join(".")] = issue.message;
    return { error: "검증 실패", fieldErrors: fe };
  }
  const s = r.data;
  await getPool().query(
    `INSERT INTO songs (title, category, artwork_url, listen_url, lyrics, released_at, published)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [s.title, s.category, s.artworkUrl, s.listenUrl || null, s.lyrics || null, s.releasedAt],
  );
  revalidatePath("/admin/songs");
  revalidatePath("/songs");
  redirect("/admin/songs");
}

export async function updateSong(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = songSchema.safeParse(fromForm(fd));
  if (!r.success) {
    const fe: Record<string, string> = {};
    for (const issue of r.error.issues) fe[issue.path.join(".")] = issue.message;
    return { error: "검증 실패", fieldErrors: fe };
  }
  const s = r.data;
  await getPool().query(
    `UPDATE songs SET title=?, category=?, artwork_url=?, listen_url=?, lyrics=?, released_at=? WHERE id=?`,
    [s.title, s.category, s.artworkUrl, s.listenUrl || null, s.lyrics || null, s.releasedAt, id],
  );
  revalidatePath("/admin/songs");
  revalidatePath(`/admin/songs/${id}`);
  revalidatePath("/songs");
  redirect("/admin/songs");
}

export async function togglePublishedSong(id: number) {
  await requireAuth();
  await getPool().query(`UPDATE songs SET published = 1 - published WHERE id = ?`, [id]);
  revalidatePath("/admin/songs");
  revalidatePath("/songs");
}
