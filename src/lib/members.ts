import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";

export type Member = {
  id: number;
  nameEn: string;
  nameKr: string;
  position: string;
  photoUrl: string;
  favoriteArtist: string | null;
  favoriteSong: string | null;
  displayOrder: number;
  published: boolean;
};

type Row = RowDataPacket & {
  id: number;
  name_en: string;
  name_kr: string;
  position: string;
  photo_url: string;
  favorite_artist: string | null;
  favorite_song: string | null;
  display_order: number;
  published: number;
};

function rowToMember(r: Row): Member {
  return {
    id: r.id,
    nameEn: r.name_en,
    nameKr: r.name_kr,
    position: r.position,
    photoUrl: r.photo_url,
    favoriteArtist: r.favorite_artist,
    favoriteSong: r.favorite_song,
    displayOrder: r.display_order,
    published: r.published === 1,
  };
}

export async function getPublishedMembers(): Promise<Member[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, name_en, name_kr, position, photo_url, favorite_artist, favorite_song, display_order, published
     FROM members
     WHERE published = 1
     ORDER BY display_order ASC, id ASC`,
  );
  return rows.map(rowToMember);
}

export async function getAllMembersForAdmin(): Promise<Member[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, name_en, name_kr, position, photo_url, favorite_artist, favorite_song, display_order, published
     FROM members
     ORDER BY display_order ASC, id ASC`,
  );
  return rows.map(rowToMember);
}

export async function getMemberById(id: number): Promise<Member | null> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT id, name_en, name_kr, position, photo_url, favorite_artist, favorite_song, display_order, published
     FROM members WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToMember(rows[0]) : null;
}

export async function countMembers(): Promise<number> {
  const [rows] = await getPool().query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) AS c FROM members",
  );
  return rows[0]?.c ?? 0;
}
