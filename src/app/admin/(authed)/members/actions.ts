"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";

const memberSchema = z.object({
  nameEn: z.string().min(1).max(80),
  nameKr: z.string().min(1).max(40),
  position: z.string().min(1).max(120),
  photoUrl: z.string().min(1).max(255),
  favoriteArtist: z.string().max(120).optional().or(z.literal("")),
  favoriteSong: z.string().max(255).optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0).max(9999),
});

async function requireAuth() {
  const s = await readSession();
  if (!s) throw new Error("UNAUTHENTICATED");
}

function fromForm(formData: FormData) {
  return {
    nameEn: formData.get("nameEn"),
    nameKr: formData.get("nameKr"),
    position: formData.get("position"),
    photoUrl: formData.get("photoUrl"),
    favoriteArtist: formData.get("favoriteArtist") ?? "",
    favoriteSong: formData.get("favoriteSong") ?? "",
    displayOrder: formData.get("displayOrder"),
  };
}

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createMember(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = memberSchema.safeParse(fromForm(fd));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fe[issue.path.join(".")] = issue.message;
    }
    return { error: "검증 실패", fieldErrors: fe };
  }
  const m = parsed.data;
  await getPool().query(
    `INSERT INTO members (name_en, name_kr, position, photo_url, favorite_artist, favorite_song, display_order, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [m.nameEn, m.nameKr, m.position, m.photoUrl, m.favoriteArtist || null, m.favoriteSong || null, m.displayOrder],
  );
  revalidatePath("/admin/members");
  revalidatePath("/members");
  redirect("/admin/members");
}

export async function updateMember(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = memberSchema.safeParse(fromForm(fd));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) fe[issue.path.join(".")] = issue.message;
    return { error: "검증 실패", fieldErrors: fe };
  }
  const m = parsed.data;
  await getPool().query(
    `UPDATE members SET name_en=?, name_kr=?, position=?, photo_url=?, favorite_artist=?, favorite_song=?, display_order=? WHERE id=?`,
    [m.nameEn, m.nameKr, m.position, m.photoUrl, m.favoriteArtist || null, m.favoriteSong || null, m.displayOrder, id],
  );
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${id}`);
  revalidatePath("/members");
  redirect("/admin/members");
}

export async function togglePublishedMember(id: number) {
  await requireAuth();
  await getPool().query(
    `UPDATE members SET published = 1 - published WHERE id = ?`,
    [id],
  );
  revalidatePath("/admin/members");
  revalidatePath("/members");
}

export async function swapMemberOrder(id: number, direction: "up" | "down") {
  await requireAuth();
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [self] = await conn.query<({ id: number; display_order: number } & import("mysql2").RowDataPacket)[]>(
      `SELECT id, display_order FROM members WHERE id = ? FOR UPDATE`,
      [id],
    );
    if (!self[0]) {
      await conn.rollback();
      return;
    }
    const op = direction === "up" ? "<" : ">";
    const order = direction === "up" ? "DESC" : "ASC";
    const [neighbor] = await conn.query<({ id: number; display_order: number } & import("mysql2").RowDataPacket)[]>(
      `SELECT id, display_order FROM members
       WHERE display_order ${op} ? OR (display_order = ? AND id ${op} ?)
       ORDER BY display_order ${order}, id ${order} LIMIT 1 FOR UPDATE`,
      [self[0].display_order, self[0].display_order, id],
    );
    if (!neighbor[0]) {
      await conn.commit();
      return;
    }
    await conn.query(
      `UPDATE members SET display_order = ? WHERE id = ?`,
      [neighbor[0].display_order, self[0].id],
    );
    await conn.query(
      `UPDATE members SET display_order = ? WHERE id = ?`,
      [self[0].display_order, neighbor[0].id],
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    const errno = (e as { errno?: number }).errno;
    if (errno === 1213) {
      // InnoDB deadlock — opposing concurrent swap. Treat as no-op; user can retry.
      return;
    }
    throw e;
  } finally {
    conn.release();
  }
  revalidatePath("/admin/members");
  revalidatePath("/members");
}
