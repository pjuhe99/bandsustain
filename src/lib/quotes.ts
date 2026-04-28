import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";

export type Quote = {
  id: number;
  text: string;
  lang: "ko" | "en";
  text_translated: string | null;
  attribution: string | null;
  portrait_url: string | null;
  created_at: Date;
  published?: number; // admin 함수에서만 셋
};

export async function getPublishedQuotes(): Promise<Quote[]> {
  const [rows] = await getPool().query<(Quote & RowDataPacket)[]>(
    `SELECT id, text, lang, text_translated, attribution, portrait_url, created_at
     FROM quotes
     WHERE published = 1
     ORDER BY created_at DESC, id DESC`
  );
  return rows;
}

export async function getAllQuotesForAdmin(): Promise<Quote[]> {
  const [rows] = await getPool().query<(Quote & RowDataPacket)[]>(
    `SELECT id, text, lang, text_translated, attribution, portrait_url, created_at, published
     FROM quotes
     ORDER BY created_at DESC, id DESC`,
  );
  return rows;
}

export async function getQuoteById(id: number): Promise<Quote | null> {
  const [rows] = await getPool().query<(Quote & RowDataPacket)[]>(
    `SELECT id, text, lang, text_translated, attribution, portrait_url, created_at, published
     FROM quotes WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export async function countQuotes(): Promise<number> {
  const [rows] = await getPool().query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) AS c FROM quotes",
  );
  return rows[0]?.c ?? 0;
}
