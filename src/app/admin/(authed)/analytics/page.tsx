import {
  getSnapshot,
  getDailyMetrics,
  getTopPaths,
  getTopReferrers,
  type DailyMetric,
} from "@/lib/analytics-stats";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [snap, daily, topPaths, topRefs] = await Promise.all([
    getSnapshot(),
    getDailyMetrics(30),
    getTopPaths(30, 20),
    getTopReferrers(30, 20),
  ]);

  return (
    <div className="space-y-10 max-w-5xl">
      <header>
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-4xl mb-2">
          Analytics
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          익명 페이지뷰 통계 — 봇 자동 제외, 일일 회전 솔트로 방문자 식별 (개인정보 미보존).
        </p>
      </header>

      {/* Snapshot cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Stat label="Today views" value={snap.todayViews} sub={`Yesterday ${snap.yesterdayViews}`} />
        <Stat label="Today visitors" value={snap.todayVisitors} sub={`Yesterday ${snap.yesterdayVisitors}`} />
        <Stat label="7d views" value={snap.last7dViews} sub={`Visitors ${snap.last7dVisitors}`} />
        <Stat label="30d views" value={snap.last30dViews} sub={`Visitors ${snap.last30dVisitors}`} />
      </section>

      {/* Daily chart */}
      <section>
        <h2 className="text-sm uppercase tracking-wider font-semibold mb-4">Last 30 days</h2>
        <DailyChart data={daily} />
      </section>

      {/* Top paths */}
      <section>
        <h2 className="text-sm uppercase tracking-wider font-semibold mb-4">
          Top paths (last 30 days)
        </h2>
        {topPaths.length === 0 ? (
          <Empty />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-text-muted)]">
                <th className="py-2 pr-4">Path</th>
                <th className="py-2 pr-4 w-24 text-right">Views</th>
                <th className="py-2 w-28 text-right">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {topPaths.map((p) => (
                <tr key={p.path} className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-4 font-mono text-xs md:text-sm break-all">{p.path}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{p.views}</td>
                  <td className="py-2 text-right tabular-nums text-[var(--color-text-muted)]">
                    {p.visitors}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Top referrers */}
      <section>
        <h2 className="text-sm uppercase tracking-wider font-semibold mb-4">
          Top referrers (last 30 days)
        </h2>
        {topRefs.length === 0 ? (
          <Empty hint="유입 추적은 외부 도메인에서 클릭한 링크만 기록됩니다 (직접 방문 / bandsustain.com 내부 이동 제외)." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-text-muted)]">
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4 w-24 text-right">Views</th>
                <th className="py-2 w-28 text-right">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {topRefs.map((r) => (
                <tr key={r.refHost} className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-4">{r.refHost}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{r.views}</td>
                  <td className="py-2 text-right tabular-nums text-[var(--color-text-muted)]">
                    {r.visitors}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="border border-[var(--color-border)] p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
        {label}
      </p>
      <p className="text-2xl md:text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
      {sub && (
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1 tabular-nums">{sub}</p>
      )}
    </div>
  );
}

function Empty({ hint }: { hint?: string }) {
  return (
    <div className="border border-dashed border-[var(--color-border)] p-6 text-sm text-[var(--color-text-muted)]">
      아직 데이터가 충분하지 않습니다.
      {hint && <span className="block mt-2 text-xs">{hint}</span>}
    </div>
  );
}

function DailyChart({ data }: { data: DailyMetric[] }) {
  const maxViews = Math.max(1, ...data.map((d) => d.views));
  const maxVisitors = Math.max(1, ...data.map((d) => d.visitors));
  const W = 800;
  const H = 200;
  const PAD = 24;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const xy = (i: number, v: number, max: number) => ({
    x: PAD + i * stepX,
    y: PAD + innerH - (v / max) * innerH,
  });

  const viewsPath = data
    .map((d, i) => {
      const p = xy(i, d.views, maxViews);
      return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join(" ");

  const visitorsPath = data
    .map((d, i) => {
      const p = xy(i, d.visitors, maxVisitors);
      return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join(" ");

  const totalViews = data.reduce((s, d) => s + d.views, 0);

  return (
    <div>
      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)] mb-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] bg-[var(--color-accent)]" /> Views
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] bg-[var(--color-text)]" /> Visitors
        </span>
        <span className="ml-auto tabular-nums">total {totalViews.toLocaleString()} views</span>
      </div>
      <div className="border border-[var(--color-border)] p-2 bg-[var(--color-bg-muted)]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          preserveAspectRatio="none"
          role="img"
          aria-label="Daily views and visitors chart"
        >
          <line
            x1={PAD}
            y1={PAD + innerH}
            x2={PAD + innerW}
            y2={PAD + innerH}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
          {totalViews > 0 && (
            <>
              <path d={viewsPath} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
              <path d={visitorsPath} fill="none" stroke="var(--color-text)" strokeWidth={1.5} strokeDasharray="4 3" />
            </>
          )}
        </svg>
        <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1 px-1">
          <span>{data[0]?.date.slice(5) ?? ""}</span>
          <span>{data[Math.floor(data.length / 2)]?.date.slice(5) ?? ""}</span>
          <span>{data[data.length - 1]?.date.slice(5) ?? ""}</span>
        </div>
      </div>
    </div>
  );
}
