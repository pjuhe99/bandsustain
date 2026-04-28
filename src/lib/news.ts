import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";

export type NewsItem = {
  id: number;
  headline: string;
  category: string;
  date: Date;
  heroImage: string;
  body: string;
  midImage: string | null;
  published: boolean;
};

type Row = RowDataPacket & {
  id: number;
  headline: string;
  category: string;
  date: Date;
  hero_image: string;
  body: string;
  mid_image: string | null;
  published: number;
};

function rowToItem(r: Row): NewsItem {
  return {
    id: r.id,
    headline: r.headline,
    category: r.category,
    date: r.date instanceof Date ? r.date : new Date(r.date),
    heroImage: r.hero_image,
    body: r.body,
    midImage: r.mid_image,
    published: r.published === 1,
  };
}

export async function getPublishedNews(): Promise<NewsItem[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, headline, category, date, hero_image, body, mid_image, published
     FROM news WHERE published = 1
     ORDER BY date DESC, id DESC`,
  );
  return rows.map(rowToItem);
}

export async function getAllNewsForAdmin(): Promise<NewsItem[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, headline, category, date, hero_image, body, mid_image, published
     FROM news ORDER BY date DESC, id DESC`,
  );
  return rows.map(rowToItem);
}

export async function getNewsById(id: number): Promise<NewsItem | null> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, headline, category, date, hero_image, body, mid_image, published
     FROM news WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToItem(rows[0]) : null;
}

export async function countNews(): Promise<number> {
  const [rows] = await getPool().query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) AS c FROM news",
  );
  return rows[0]?.c ?? 0;
}

export function formatNewsDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function excerpt(body: string, max: number): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1) + "…";
}
