import "server-only";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "./db";

export type LiveEvent = {
  id: number;
  eventDate: string;          // YYYY-MM-DD (KST)
  venue: string;
  city: string;
  ticketUrl: string | null;
  videoUrl: string | null;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type Row = RowDataPacket & {
  id: number;
  event_date: Date | string;
  venue: string;
  city: string;
  ticket_url: string | null;
  video_url: string | null;
  published: number;
  created_at: Date;
  updated_at: Date;
};

function toDateString(v: Date | string): string {
  if (v instanceof Date) {
    // mysql2는 DATE 컬럼을 로컬 타임존 자정의 Date로 돌려준다(`new Date(yyyy, mm-1, dd)`).
    // toISOString()은 UTC로 변환하므로 KST 서버에서는 하루 어긋난다. 로컬 컴포넌트로 그대로 추출.
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  return v.slice(0, 10);
}

function rowToEvent(r: Row): LiveEvent {
  return {
    id: r.id,
    eventDate: toDateString(r.event_date),
    venue: r.venue,
    city: r.city,
    ticketUrl: r.ticket_url,
    videoUrl: r.video_url,
    published: r.published === 1,
    createdAt: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at),
  };
}

export function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const SELECT_COLS =
  "id, event_date, venue, city, ticket_url, video_url, published, created_at, updated_at";

export async function getUpcomingEvents(): Promise<LiveEvent[]> {
  const today = todayKST();
  const [rows] = await getPool().query<Row[]>(
    `SELECT ${SELECT_COLS} FROM live_events
     WHERE published = 1 AND event_date >= ?
     ORDER BY event_date ASC, id ASC`,
    [today],
  );
  return rows.map(rowToEvent);
}

export async function getPastEventsByYear(): Promise<Map<number, LiveEvent[]>> {
  const today = todayKST();
  const [rows] = await getPool().query<Row[]>(
    `SELECT ${SELECT_COLS} FROM live_events
     WHERE published = 1 AND event_date < ?
     ORDER BY event_date DESC, id DESC`,
    [today],
  );
  const grouped = new Map<number, LiveEvent[]>();
  for (const r of rows) {
    const ev = rowToEvent(r);
    const year = Number(ev.eventDate.slice(0, 4));
    const list = grouped.get(year);
    if (list) list.push(ev);
    else grouped.set(year, [ev]);
  }
  return grouped;
}

export async function listAllLiveEvents(): Promise<LiveEvent[]> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT ${SELECT_COLS} FROM live_events ORDER BY event_date DESC, id DESC`,
  );
  return rows.map(rowToEvent);
}

export async function getLiveEvent(id: number): Promise<LiveEvent | null> {
  const [rows] = await getPool().query<Row[]>(
    `SELECT ${SELECT_COLS} FROM live_events WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToEvent(rows[0]) : null;
}

export async function countLiveEvents(): Promise<number> {
  const [rows] = await getPool().query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) AS c FROM live_events",
  );
  return rows[0]?.c ?? 0;
}

export type LiveEventInput = {
  eventDate: string;     // YYYY-MM-DD
  venue: string;
  city: string;
  ticketUrl: string | null;
  videoUrl: string | null;
  published: boolean;
};

export async function createLiveEvent(input: LiveEventInput): Promise<number> {
  const [res] = await getPool().query<ResultSetHeader>(
    `INSERT INTO live_events
       (event_date, venue, city, ticket_url, video_url, published)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.eventDate,
      input.venue,
      input.city,
      input.ticketUrl,
      input.videoUrl,
      input.published ? 1 : 0,
    ],
  );
  return res.insertId;
}

export async function updateLiveEvent(id: number, input: LiveEventInput): Promise<void> {
  await getPool().query(
    `UPDATE live_events
       SET event_date=?, venue=?, city=?, ticket_url=?, video_url=?, published=?
     WHERE id=?`,
    [
      input.eventDate,
      input.venue,
      input.city,
      input.ticketUrl,
      input.videoUrl,
      input.published ? 1 : 0,
      id,
    ],
  );
}

export async function setLiveEventPublished(id: number, published: boolean): Promise<void> {
  await getPool().query(
    `UPDATE live_events SET published = ? WHERE id = ?`,
    [published ? 1 : 0, id],
  );
}

export async function togglePublishedLiveEvent(id: number): Promise<void> {
  await getPool().query(
    `UPDATE live_events SET published = 1 - published WHERE id = ?`,
    [id],
  );
}

function formatMonthDay(eventDate: string): string {
  const [y, m, d] = eventDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "2-digit",
  }).format(dt).toUpperCase();
}

// "MAY 24" — Past 그룹(연도 헤더 위에 이미 연도) + 어드민 리스트용
export function formatLiveDate(eventDate: string): string {
  return formatMonthDay(eventDate);
}

// "MAY 24 · 2026" — Upcoming 행용 (연도가 같이 노출되어야 함)
export function formatLiveDateWithYear(eventDate: string): string {
  return `${formatMonthDay(eventDate)} · ${eventDate.slice(0, 4)}`;
}
