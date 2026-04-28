"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

const newsSchema = z.object({
  headline: z.string().min(1).max(255),
  category: z.string().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식"),
  heroImage: z.string().min(1).max(255),
  body: z.string().min(1),
  midImage: z.string().max(255).optional().or(z.literal("")),
});

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}

function fromForm(fd: FormData) {
  return {
    headline: fd.get("headline"),
    category: fd.get("category"),
    date: fd.get("date"),
    heroImage: fd.get("heroImage"),
    body: fd.get("body"),
    midImage: fd.get("midImage") ?? "",
  };
}

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createNews(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = newsSchema.safeParse(fromForm(fd));
  if (!r.success) {
    const fe: Record<string, string> = {};
    for (const issue of r.error.issues) fe[issue.path.join(".")] = issue.message;
    return { error: "검증 실패", fieldErrors: fe };
  }
  const n = r.data;
  await getPool().query(
    `INSERT INTO news (headline, category, date, hero_image, body, mid_image, published)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [n.headline, n.category, n.date, n.heroImage, n.body, n.midImage || null],
  );
  revalidatePath("/admin/news");
  revalidatePath("/news");
  redirect("/admin/news");
}

export async function updateNews(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = newsSchema.safeParse(fromForm(fd));
  if (!r.success) {
    const fe: Record<string, string> = {};
    for (const issue of r.error.issues) fe[issue.path.join(".")] = issue.message;
    return { error: "검증 실패", fieldErrors: fe };
  }
  const n = r.data;
  await getPool().query(
    `UPDATE news SET headline=?, category=?, date=?, hero_image=?, body=?, mid_image=? WHERE id=?`,
    [n.headline, n.category, n.date, n.heroImage, n.body, n.midImage || null, id],
  );
  revalidatePath("/admin/news");
  revalidatePath(`/admin/news/${id}`);
  revalidatePath("/news");
  revalidatePath(`/news/${id}`);
  redirect("/admin/news");
}

export async function togglePublishedNews(id: number) {
  await requireAuth();
  await getPool().query(`UPDATE news SET published = 1 - published WHERE id = ?`, [id]);
  revalidatePath("/admin/news");
  revalidatePath("/news");
}
