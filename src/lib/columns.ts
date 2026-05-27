import "server-only";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "./db";
import { maskIp } from "./columnsFormat";

export type ColumnTopic = {
  id: number;
  title: string;
  memberId: number | null;
  authorName: string | null; // members.name_kr
  description: string | null;
  visible: boolean;
  sortOrder: number;
};

export type ColumnPost = {
  id: number;
  topicId: number;
  topicTitle: string;
  authorName: string | null;
  title: string;
  heroImage: string | null;
  excerpt: string | null;
  body: string;
  viewCount: number;
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  commentCount: number;
};

// data-layer shape (distinct from ColumnComments.tsx's client `PublicComment`)
export type VisibleComment = {
  id: number;
  nickname: string;
  ipMasked: string;
  body: string;
  createdAt: Date;
  hasPassword: boolean;
};

export type AdminComment = {
  id: number;
  postId: number;
  postTitle: string;
  nickname: string;
  ip: string;
  body: string;
  visible: boolean;
  createdAt: Date;
};

type TopicRow = RowDataPacket & {
  id: number; title: string; member_id: number | null; author_name: string | null;
  description: string | null; visible: number; sort_order: number;
};
type PostRow = RowDataPacket & {
  id: number; topic_id: number; topic_title: string; author_name: string | null;
  title: string; hero_image: string | null; excerpt: string | null; body: string;
  view_count: number; published: number; published_at: Date | null; created_at: Date;
  comment_count: number;
};

function toTopic(r: TopicRow): ColumnTopic {
  return {
    id: r.id, title: r.title, memberId: r.member_id, authorName: r.author_name,
    description: r.description, visible: r.visible === 1, sortOrder: r.sort_order,
  };
}
function toDate(v: Date | string | null): Date | null {
  if (v === null) return null;
  return v instanceof Date ? v : new Date(v);
}
function toPost(r: PostRow): ColumnPost {
  return {
    id: r.id, topicId: r.topic_id, topicTitle: r.topic_title, authorName: r.author_name,
    title: r.title, heroImage: r.hero_image, excerpt: r.excerpt, body: r.body,
    viewCount: r.view_count, published: r.published === 1,
    publishedAt: toDate(r.published_at), createdAt: toDate(r.created_at) as Date,
    commentCount: Number(r.comment_count ?? 0),
  };
}

const POST_SELECT = `
  SELECT p.id, p.topic_id, t.title AS topic_title, m.name_kr AS author_name,
         p.title, p.hero_image, p.excerpt, p.body, p.view_count, p.published,
         p.published_at, p.created_at,
         (SELECT COUNT(*) FROM column_comments c WHERE c.post_id = p.id AND c.visible = 1) AS comment_count
  FROM column_posts p
  JOIN column_topics t ON t.id = p.topic_id
  LEFT JOIN members m ON m.id = t.member_id`;

// ---- topics ----
export async function getVisibleTopics(): Promise<ColumnTopic[]> {
  const [rows] = await getPool().query<TopicRow[]>(
    `SELECT t.id, t.title, t.member_id, m.name_kr AS author_name, t.description, t.visible, t.sort_order
     FROM column_topics t LEFT JOIN members m ON m.id = t.member_id
     WHERE t.visible = 1 ORDER BY t.sort_order ASC, t.id ASC`,
  );
  return rows.map(toTopic);
}
export async function getAllTopicsForAdmin(): Promise<ColumnTopic[]> {
  const [rows] = await getPool().query<TopicRow[]>(
    `SELECT t.id, t.title, t.member_id, m.name_kr AS author_name, t.description, t.visible, t.sort_order
     FROM column_topics t LEFT JOIN members m ON m.id = t.member_id
     ORDER BY t.sort_order ASC, t.id ASC`,
  );
  return rows.map(toTopic);
}
export async function getTopicById(id: number): Promise<ColumnTopic | null> {
  const [rows] = await getPool().query<TopicRow[]>(
    `SELECT t.id, t.title, t.member_id, m.name_kr AS author_name, t.description, t.visible, t.sort_order
     FROM column_topics t LEFT JOIN members m ON m.id = t.member_id WHERE t.id = ?`, [id],
  );
  return rows[0] ? toTopic(rows[0]) : null;
}

// ---- posts ----
export async function getPublishedPosts(opts: { topicId?: number } = {}): Promise<ColumnPost[]> {
  const where = `WHERE p.published = 1 AND t.visible = 1${opts.topicId ? " AND p.topic_id = ?" : ""}`;
  const order = `ORDER BY COALESCE(p.published_at, p.created_at) DESC, p.id DESC`;
  const args = opts.topicId ? [opts.topicId] : [];
  const [rows] = await getPool().query<PostRow[]>(`${POST_SELECT} ${where} ${order}`, args);
  return rows.map(toPost);
}
export async function getAllPostsForAdmin(): Promise<ColumnPost[]> {
  // comment_count here counts ALL comments (incl. hidden) for moderation overview
  const [rows] = await getPool().query<PostRow[]>(
    `SELECT p.id, p.topic_id, t.title AS topic_title, m.name_kr AS author_name,
            p.title, p.hero_image, p.excerpt, p.body, p.view_count, p.published,
            p.published_at, p.created_at,
            (SELECT COUNT(*) FROM column_comments c WHERE c.post_id = p.id) AS comment_count
     FROM column_posts p
     JOIN column_topics t ON t.id = p.topic_id
     LEFT JOIN members m ON m.id = t.member_id
     ORDER BY p.created_at DESC, p.id DESC`,
  );
  return rows.map(toPost);
}
export async function getPublishedPostById(id: number): Promise<ColumnPost | null> {
  const [rows] = await getPool().query<PostRow[]>(
    `${POST_SELECT} WHERE p.id = ? AND p.published = 1 AND t.visible = 1`, [id],
  );
  return rows[0] ? toPost(rows[0]) : null;
}
export async function getPostByIdForAdmin(id: number): Promise<ColumnPost | null> {
  const [rows] = await getPool().query<PostRow[]>(`${POST_SELECT} WHERE p.id = ?`, [id]);
  return rows[0] ? toPost(rows[0]) : null;
}
export async function incrementViewCount(id: number): Promise<void> {
  await getPool().query(`UPDATE column_posts SET view_count = view_count + 1 WHERE id = ?`, [id]);
}
export async function canCommentOnPost(id: number): Promise<boolean> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT 1 FROM column_posts p JOIN column_topics t ON t.id = p.topic_id
     WHERE p.id = ? AND p.published = 1 AND t.visible = 1 LIMIT 1`, [id],
  );
  return rows.length > 0;
}

// ---- comments ----
export async function getVisibleComments(postId: number): Promise<VisibleComment[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, nickname, ip, body, password_hash, created_at
     FROM column_comments WHERE post_id = ? AND visible = 1 ORDER BY created_at ASC, id ASC`, [postId],
  );
  return rows.map((r) => ({
    id: r.id, nickname: r.nickname, ipMasked: maskIp(r.ip), body: r.body,
    createdAt: toDate(r.created_at) as Date, hasPassword: r.password_hash != null,
  }));
}
export async function getAllCommentsForAdmin(opts: { postId?: number } = {}): Promise<AdminComment[]> {
  const where = opts.postId ? "WHERE c.post_id = ?" : "";
  const args = opts.postId ? [opts.postId] : [];
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT c.id, c.post_id, p.title AS post_title, c.nickname, c.ip, c.body, c.visible, c.created_at
     FROM column_comments c JOIN column_posts p ON p.id = c.post_id
     ${where} ORDER BY c.created_at DESC, c.id DESC`, args,
  );
  return rows.map((r) => ({
    id: r.id, postId: r.post_id, postTitle: r.post_title, nickname: r.nickname,
    ip: r.ip, body: r.body, visible: r.visible === 1, createdAt: toDate(r.created_at) as Date,
  }));
}
export async function getLatestCommentAtByIp(ip: string): Promise<Date | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT created_at FROM column_comments WHERE ip = ? ORDER BY id DESC LIMIT 1`, [ip],
  );
  return rows[0] ? (toDate(rows[0].created_at) as Date) : null;
}
export async function getCommentAuthRow(
  id: number,
): Promise<{ id: number; postId: number; passwordHash: string | null } | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, post_id, password_hash FROM column_comments WHERE id = ?`, [id],
  );
  return rows[0] ? { id: rows[0].id, postId: rows[0].post_id, passwordHash: rows[0].password_hash } : null;
}
export async function insertComment(input: {
  postId: number; nickname: string; body: string; ip: string; passwordHash: string | null;
}): Promise<number> {
  const [res] = await getPool().query<ResultSetHeader>(
    `INSERT INTO column_comments (post_id, nickname, password_hash, body, ip, visible)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [input.postId, input.nickname, input.passwordHash, input.body, input.ip],
  );
  return res.insertId;
}
export async function deleteCommentById(id: number): Promise<void> {
  await getPool().query(`DELETE FROM column_comments WHERE id = ?`, [id]);
}
export async function setCommentVisible(id: number, visible: boolean): Promise<void> {
  await getPool().query(`UPDATE column_comments SET visible = ? WHERE id = ?`, [visible ? 1 : 0, id]);
}
