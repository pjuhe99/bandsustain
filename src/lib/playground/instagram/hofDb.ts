import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export type HofListItem = { id: number; nickname: string; followedAt: string };

export type HofAdminRow = {
  id: number;
  nickname: string;
  sustainFollowedAt: string; // "YYYY-MM-DD"
  createdAt: string;
  isVisible: boolean;
  ipHashPrefix: string; // admin 표시용 앞 10자만 (전체값 미노출)
};

export async function listVisibleHof(
  page: number,
  pageSize: number,
): Promise<{ items: HofListItem[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, nickname, DATE_FORMAT(sustain_followed_at, '%Y-%m-%d') AS followedAt
       FROM instagram_follow_hof
      WHERE is_visible = 1
      ORDER BY sustain_followed_at ASC, created_at ASC, id ASC
      LIMIT ? OFFSET ?`,
    [pageSize, offset],
  );
  const [cnt] = await getPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM instagram_follow_hof WHERE is_visible = 1`,
  );
  return {
    items: rows.map((r) => ({
      id: r.id as number,
      nickname: r.nickname as string,
      followedAt: r.followedAt as string,
    })),
    total: Number(cnt[0].total),
  };
}

export type InsertHofResult =
  | { ok: true; id: number }
  | { ok: false; code: "DUPLICATE_ENTRY" };

export async function insertHof(input: {
  nickname: string;
  sustainFollowedAt: string; // "YYYY-MM-DD"
  ipHash: string;
  browserTokenHash: string | null;
}): Promise<InsertHofResult> {
  try {
    const [res] = await getPool().query<ResultSetHeader>(
      `INSERT INTO instagram_follow_hof (nickname, sustain_followed_at, ip_hash, browser_token_hash)
       VALUES (?, ?, ?, ?)`,
      [input.nickname, input.sustainFollowedAt, input.ipHash, input.browserTokenHash],
    );
    return { ok: true, id: res.insertId };
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { errno?: number }).errno === 1062) {
      return { ok: false, code: "DUPLICATE_ENTRY" };
    }
    throw e;
  }
}

export async function adminListHof(search: string | null): Promise<HofAdminRow[]> {
  const escaped = search ? search.replace(/[%_\\]/g, "\\$&") : null;
  const where = escaped ? `WHERE nickname LIKE ?` : "";
  const params = escaped ? [`%${escaped}%`] : [];
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, nickname, DATE_FORMAT(sustain_followed_at, '%Y-%m-%d') AS followedAt, is_visible,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS createdAt,
            LEFT(ip_hash, 10) AS ipHashPrefix
       FROM instagram_follow_hof ${where}
      ORDER BY created_at DESC LIMIT 500`,
    params,
  );
  return rows.map((r) => ({
    id: r.id as number,
    nickname: r.nickname as string,
    sustainFollowedAt: r.followedAt as string,
    createdAt: r.createdAt as string,
    isVisible: r.is_visible === 1,
    ipHashPrefix: r.ipHashPrefix as string,
  }));
}

export async function setHofVisibility(id: number, visible: boolean): Promise<void> {
  await getPool().query(`UPDATE instagram_follow_hof SET is_visible = ? WHERE id = ?`, [
    visible ? 1 : 0,
    id,
  ]);
}
