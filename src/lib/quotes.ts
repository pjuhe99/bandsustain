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
