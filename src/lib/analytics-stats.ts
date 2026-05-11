import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "./db";

export type DailyMetric = {
  date: string;
  views: number;
  visitors: number;
};

export type PathStat = {
  path: string;
  views: number;
  visitors: number;
};

export type RefStat = {
  refHost: string;
  views: number;
  visitors: number;
};

export type Snapshot = {
  todayViews: number;
  todayVisitors: number;
  yesterdayViews: number;
  yesterdayVisitors: number;
  thisMonthViews: number;
  thisMonthVisitors: number;
};

// MySQL session timezone is +09:00 (KST), so DATE(ts) is already KST-aligned.
// Visitor hash uses monthly salt → unique-visitor counts within the same
// calendar month are exact; cross-month windows over-count returning visitors
// (they appear once per month they touched).

export async function getSnapshot(): Promise<Snapshot> {
  const [rows] = await getPool().query<(RowDataPacket & {
    period: string;
    views: number;
    visitors: number;
  })[]>(
    `SELECT 'today' AS period,
            COUNT(*) AS views,
            COUNT(DISTINCT visitor_hash) AS visitors
       FROM analytics_events
      WHERE DATE(ts) = CURDATE()
     UNION ALL
     SELECT 'yesterday',
            COUNT(*),
            COUNT(DISTINCT visitor_hash)
       FROM analytics_events
      WHERE DATE(ts) = CURDATE() - INTERVAL 1 DAY
     UNION ALL
     SELECT 'thisMonth',
            COUNT(*),
            COUNT(DISTINCT visitor_hash)
       FROM analytics_events
      WHERE DATE_FORMAT(ts, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
  );

  const m: Record<string, { views: number; visitors: number }> = {};
  for (const r of rows) m[r.period] = { views: Number(r.views), visitors: Number(r.visitors) };

  return {
    todayViews: m.today?.views ?? 0,
    todayVisitors: m.today?.visitors ?? 0,
    yesterdayViews: m.yesterday?.views ?? 0,
    yesterdayVisitors: m.yesterday?.visitors ?? 0,
    thisMonthViews: m.thisMonth?.views ?? 0,
    thisMonthVisitors: m.thisMonth?.visitors ?? 0,
  };
}

// 30-day daily trend: each day's per-day visitor count is exact DAU
// (COUNT DISTINCT within a single day is unaffected by salt-rotation period).
export async function getDailyMetrics(days: number): Promise<DailyMetric[]> {
  const [rows] = await getPool().query<(RowDataPacket & {
    d: Date | string;
    views: number;
    visitors: number;
  })[]>(
    `SELECT DATE(ts) AS d,
            COUNT(*) AS views,
            COUNT(DISTINCT visitor_hash) AS visitors
       FROM analytics_events
      WHERE ts >= CURDATE() - INTERVAL ? DAY
   GROUP BY DATE(ts)
   ORDER BY d ASC`,
    [days],
  );

  const byDate = new Map<string, { views: number; visitors: number }>();
  for (const r of rows) {
    const dateStr =
      r.d instanceof Date
        ? `${r.d.getFullYear()}-${String(r.d.getMonth() + 1).padStart(2, "0")}-${String(r.d.getDate()).padStart(2, "0")}`
        : String(r.d).slice(0, 10);
    byDate.set(dateStr, { views: Number(r.views), visitors: Number(r.visitors) });
  }

  const out: DailyMetric[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const v = byDate.get(key) ?? { views: 0, visitors: 0 };
    out.push({ date: key, views: v.views, visitors: v.visitors });
  }
  return out;
}

// Top paths/refs scoped to current calendar month so unique-visitor count
// stays accurate under monthly salt rotation.
export async function getTopPathsThisMonth(limit = 20): Promise<PathStat[]> {
  const [rows] = await getPool().query<(RowDataPacket & {
    path: string;
    views: number;
    visitors: number;
  })[]>(
    `SELECT path,
            COUNT(*) AS views,
            COUNT(DISTINCT visitor_hash) AS visitors
       FROM analytics_events
      WHERE DATE_FORMAT(ts, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
   GROUP BY path
   ORDER BY views DESC
      LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    path: r.path,
    views: Number(r.views),
    visitors: Number(r.visitors),
  }));
}

export async function getTopReferrersThisMonth(limit = 20): Promise<RefStat[]> {
  const [rows] = await getPool().query<(RowDataPacket & {
    ref_host: string;
    views: number;
    visitors: number;
  })[]>(
    `SELECT ref_host,
            COUNT(*) AS views,
            COUNT(DISTINCT visitor_hash) AS visitors
       FROM analytics_events
      WHERE DATE_FORMAT(ts, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
        AND ref_host IS NOT NULL
   GROUP BY ref_host
   ORDER BY views DESC
      LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    refHost: r.ref_host,
    views: Number(r.views),
    visitors: Number(r.visitors),
  }));
}

// ============================================================================
// Click events (analytics_clicks)
// ============================================================================

export type ClickedSong = {
  songId: number;
  title: string;
  artworkUrl: string;
  clicks: number;
  uniqueClickers: number;
};

export type ClickedLive = {
  liveId: number;
  venue: string;
  city: string;
  eventDate: string;
  clicks: number;
  uniqueClickers: number;
};

export type ClickHostStat = {
  targetHost: string;
  clicks: number;
  uniqueClickers: number;
};

export type ClickSnapshot = {
  todayClicks: number;
  thisMonthClicks: number;
  thisMonthUniqueClickers: number;
};

export async function getClickSnapshot(): Promise<ClickSnapshot> {
  const [rows] = await getPool().query<(RowDataPacket & {
    period: string;
    clicks: number;
    visitors: number;
  })[]>(
    `SELECT 'today' AS period,
            COUNT(*) AS clicks,
            COUNT(DISTINCT visitor_hash) AS visitors
       FROM analytics_clicks
      WHERE DATE(ts) = CURDATE()
     UNION ALL
     SELECT 'thisMonth',
            COUNT(*),
            COUNT(DISTINCT visitor_hash)
       FROM analytics_clicks
      WHERE DATE_FORMAT(ts, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
  );
  const m: Record<string, { clicks: number; visitors: number }> = {};
  for (const r of rows) m[r.period] = { clicks: Number(r.clicks), visitors: Number(r.visitors) };
  return {
    todayClicks: m.today?.clicks ?? 0,
    thisMonthClicks: m.thisMonth?.clicks ?? 0,
    thisMonthUniqueClickers: m.thisMonth?.visitors ?? 0,
  };
}

export async function getTopClickedSongsThisMonth(limit = 20): Promise<ClickedSong[]> {
  const [rows] = await getPool().query<(RowDataPacket & {
    item_id: number;
    title: string;
    artwork_url: string;
    clicks: number;
    unique_clickers: number;
  })[]>(
    `SELECT c.item_id,
            s.title,
            s.artwork_url,
            COUNT(*) AS clicks,
            COUNT(DISTINCT c.visitor_hash) AS unique_clickers
       FROM analytics_clicks c
       JOIN songs s ON s.id = c.item_id
      WHERE c.item_type = 'song'
        AND DATE_FORMAT(c.ts, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
   GROUP BY c.item_id, s.title, s.artwork_url
   ORDER BY clicks DESC
      LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    songId: r.item_id,
    title: r.title,
    artworkUrl: r.artwork_url,
    clicks: Number(r.clicks),
    uniqueClickers: Number(r.unique_clickers),
  }));
}

export async function getTopClickedLiveThisMonth(limit = 20): Promise<ClickedLive[]> {
  const [rows] = await getPool().query<(RowDataPacket & {
    item_id: number;
    venue: string;
    city: string;
    event_date: Date | string;
    clicks: number;
    unique_clickers: number;
  })[]>(
    `SELECT c.item_id,
            l.venue,
            l.city,
            l.event_date,
            COUNT(*) AS clicks,
            COUNT(DISTINCT c.visitor_hash) AS unique_clickers
       FROM analytics_clicks c
       JOIN live_events l ON l.id = c.item_id
      WHERE c.item_type = 'live'
        AND DATE_FORMAT(c.ts, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
   GROUP BY c.item_id, l.venue, l.city, l.event_date
   ORDER BY clicks DESC
      LIMIT ?`,
    [limit],
  );
  return rows.map((r) => {
    const ed = r.event_date;
    const dateStr =
      ed instanceof Date
        ? `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, "0")}-${String(ed.getDate()).padStart(2, "0")}`
        : String(ed).slice(0, 10);
    return {
      liveId: r.item_id,
      venue: r.venue,
      city: r.city,
      eventDate: dateStr,
      clicks: Number(r.clicks),
      uniqueClickers: Number(r.unique_clickers),
    };
  });
}

export async function getTopClickHostsThisMonth(limit = 20): Promise<ClickHostStat[]> {
  const [rows] = await getPool().query<(RowDataPacket & {
    target_host: string;
    clicks: number;
    unique_clickers: number;
  })[]>(
    `SELECT target_host,
            COUNT(*) AS clicks,
            COUNT(DISTINCT visitor_hash) AS unique_clickers
       FROM analytics_clicks
      WHERE DATE_FORMAT(ts, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
   GROUP BY target_host
   ORDER BY clicks DESC
      LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    targetHost: r.target_host,
    clicks: Number(r.clicks),
    uniqueClickers: Number(r.unique_clickers),
  }));
}
