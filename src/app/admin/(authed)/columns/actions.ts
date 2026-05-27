"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { topicSchema, postSchema } from "@/lib/columnsValidation";
import type { RowDataPacket } from "mysql2";

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}
function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fe: Record<string, string> = {};
  for (const i of issues) fe[i.path.join(".")] = i.message;
  return fe;
}
function revalidateColumns() {
  revalidatePath("/admin/columns");
  revalidatePath("/admin/columns/topics");
  revalidatePath("/columns");
}

// ---------- topics ----------
export async function createTopic(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = topicSchema.safeParse({
    title: fd.get("title"),
    memberId: fd.get("memberId") ?? "",
    description: fd.get("description") ?? "",
    sortOrder: fd.get("sortOrder") ?? "",
  });
  if (!r.success) return { error: "검증 실패", fieldErrors: fieldErrors(r.error.issues) };
  const t = r.data;
  await getPool().query(
    `INSERT INTO column_topics (title, member_id, description, sort_order, visible)
     VALUES (?, ?, ?, ?, 1)`,
    [t.title, t.memberId ?? null, t.description || null, t.sortOrder],
  );
  revalidateColumns();
  redirect("/admin/columns/topics");
}

export async function updateTopic(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = topicSchema.safeParse({
    title: fd.get("title"),
    memberId: fd.get("memberId") ?? "",
    description: fd.get("description") ?? "",
    sortOrder: fd.get("sortOrder") ?? "",
  });
  if (!r.success) return { error: "검증 실패", fieldErrors: fieldErrors(r.error.issues) };
  const t = r.data;
  await getPool().query(
    `UPDATE column_topics SET title=?, member_id=?, description=?, sort_order=? WHERE id=?`,
    [t.title, t.memberId ?? null, t.description || null, t.sortOrder, id],
  );
  revalidateColumns();
  redirect("/admin/columns/topics");
}

export async function toggleTopicVisible(id: number) {
  await requireAuth();
  await getPool().query(`UPDATE column_topics SET visible = 1 - visible WHERE id = ?`, [id]);
  revalidateColumns();
}

export async function deleteTopic(id: number) {
  await requireAuth();
  // CASCADE removes posts + their comments
  await getPool().query(`DELETE FROM column_topics WHERE id = ?`, [id]);
  revalidateColumns();
}

// ---------- posts ----------
function readPostForm(fd: FormData) {
  return {
    topicId: fd.get("topicId"),
    title: fd.get("title"),
    heroImage: fd.get("heroImage") ?? "",
    excerpt: fd.get("excerpt") ?? "",
    body: fd.get("body"),
  };
}

export async function createPost(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = postSchema.safeParse(readPostForm(fd));
  if (!r.success) return { error: "검증 실패", fieldErrors: fieldErrors(r.error.issues) };
  const p = r.data;
  const published = fd.get("published") === "on" ? 1 : 0;
  const publishedAt = published === 1 ? new Date() : null;
  await getPool().query(
    `INSERT INTO column_posts (topic_id, title, hero_image, excerpt, body, published, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.topicId, p.title, p.heroImage || null, p.excerpt || null, p.body, published, publishedAt],
  );
  revalidateColumns();
  redirect("/admin/columns");
}

export async function updatePost(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = postSchema.safeParse(readPostForm(fd));
  if (!r.success) return { error: "검증 실패", fieldErrors: fieldErrors(r.error.issues) };
  const p = r.data;
  const published = fd.get("published") === "on" ? 1 : 0;

  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT published_at FROM column_posts WHERE id = ?`, [id],
  );
  let publishedAt: Date | null = rows[0]?.published_at ? new Date(rows[0].published_at) : null;
  if (published === 1 && publishedAt === null) publishedAt = new Date();

  await getPool().query(
    `UPDATE column_posts SET topic_id=?, title=?, hero_image=?, excerpt=?, body=?, published=?, published_at=? WHERE id=?`,
    [p.topicId, p.title, p.heroImage || null, p.excerpt || null, p.body, published, publishedAt, id],
  );
  revalidateColumns();
  revalidatePath(`/columns/${id}`);
  redirect("/admin/columns");
}

export async function togglePostPublished(id: number) {
  await requireAuth();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT published, published_at FROM column_posts WHERE id = ?`, [id],
  );
  if (!rows[0]) return;
  const next = rows[0].published === 1 ? 0 : 1;
  if (next === 1 && rows[0].published_at == null) {
    await getPool().query(`UPDATE column_posts SET published=1, published_at=NOW() WHERE id=?`, [id]);
  } else {
    await getPool().query(`UPDATE column_posts SET published=? WHERE id=?`, [next, id]);
  }
  revalidateColumns();
  revalidatePath(`/columns/${id}`);
}

export async function deletePost(id: number) {
  await requireAuth();
  await getPool().query(`DELETE FROM column_posts WHERE id = ?`, [id]);
  revalidateColumns();
}

// ---------- comments (moderation) ----------
export async function toggleCommentVisibleAdmin(id: number) {
  await requireAuth();
  await getPool().query(`UPDATE column_comments SET visible = 1 - visible WHERE id = ?`, [id]);
  revalidatePath("/admin/columns/comments");
  revalidatePath("/columns");
}

export async function deleteCommentAdmin(id: number) {
  await requireAuth();
  await getPool().query(`DELETE FROM column_comments WHERE id = ?`, [id]);
  revalidatePath("/admin/columns/comments");
  revalidatePath("/columns");
}
