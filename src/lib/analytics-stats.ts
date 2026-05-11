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
