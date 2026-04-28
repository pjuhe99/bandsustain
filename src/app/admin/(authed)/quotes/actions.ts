"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

const quoteSchema = z.object({
  text: z.string().min(1),
  lang: z.enum(["ko", "en"]),
  textTranslated: z.string().optional().or(z.literal("")),
  attribution: z.string().max(120).optional().or(z.literal("")),
  portraitUrl: z.string().max(255).optional().or(z.literal("")),
});

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}

function fromForm(fd: FormData) {
  return {
    text: fd.get("text"),
    lang: fd.get("lang"),
    textTranslated: fd.get("textTranslated") ?? "",
    attribution: fd.get("attribution") ?? "",
    portraitUrl: fd.get("portraitUrl") ?? "",
  };
}

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createQuote(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = quoteSchema.safeParse(fromForm(fd));
  if (!r.success) {
    const fe: Record<string, string> = {};
    for (const issue of r.error.issues) fe[issue.path.join(".")] = issue.message;
    return { error: "검증 실패", fieldErrors: fe };
  }
  const q = r.data;
  await getPool().query(
    `INSERT INTO quotes (text, lang, text_translated, attribution, portrait_url, published)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [q.text, q.lang, q.textTranslated || null, q.attribution || null, q.portraitUrl || null],
  );
  revalidatePath("/admin/quotes");
  revalidatePath("/quote");
  redirect("/admin/quotes");
}

export async function updateQuote(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = quoteSchema.safeParse(fromForm(fd));
  if (!r.success) {
    const fe: Record<string, string> = {};
    for (const issue of r.error.issues) fe[issue.path.join(".")] = issue.message;
    return { error: "검증 실패", fieldErrors: fe };
  }
  const q = r.data;
  await getPool().query(
    `UPDATE quotes SET text=?, lang=?, text_translated=?, attribution=?, portrait_url=? WHERE id=?`,
    [q.text, q.lang, q.textTranslated || null, q.attribution || null, q.portraitUrl || null, id],
  );
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  revalidatePath("/quote");
  redirect("/admin/quotes");
}

export async function togglePublishedQuote(id: number) {
  await requireAuth();
  await getPool().query(`UPDATE quotes SET published = 1 - published WHERE id = ?`, [id]);
  revalidatePath("/admin/quotes");
  revalidatePath("/quote");
}
