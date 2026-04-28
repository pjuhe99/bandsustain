import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";

export type SongCategory = "Album" | "EP" | "Single" | "Live Session";

export type Song = {
  id: number;
  title: string;
  category: SongCategory;
  artworkUrl: string;
  listenUrl: string | null;
  lyrics: string | null;
  releasedAt: Date;
  published: boolean;
};

type Row = RowDataPacket & {
  id: number;
  title: string;
  category: SongCategory;
  artwork_url: string;
  listen_url: string | null;
  lyrics: string | null;
  released_at: Date;
  published: number;
};

function rowToSong(r: Row): Song {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    artworkUrl: r.artwork_url,
    listenUrl: r.listen_url,
    lyrics: r.lyrics,
    releasedAt: r.released_at instanceof Date ? r.released_at : new Date(r.released_at),
    published: r.published === 1,
  };
}

export async function getPublishedSongs(): Promise<Song[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, title, category, artwork_url, listen_url, lyrics, released_at, published
     FROM songs WHERE published = 1
     ORDER BY released_at DESC, id DESC`,
  );
  return rows.map(rowToSong);
}

export async function getAllSongsForAdmin(): Promise<Song[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, title, category, artwork_url, listen_url, lyrics, released_at, published
     FROM songs ORDER BY released_at DESC, id DESC`,
  );
  return rows.map(rowToSong);
}

export async function getSongById(id: number): Promise<Song | null> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, title, category, artwork_url, listen_url, lyrics, released_at, published
     FROM songs WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToSong(rows[0]) : null;
}

export async function countSongs(): Promise<number> {
  const [rows] = await getPool().query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) AS c FROM songs",
  );
  return rows[0]?.c ?? 0;
}
