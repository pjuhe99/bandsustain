import {
  getSnapshot,
  getDailyMetrics,
  getTopPathsThisMonth,
  getTopReferrersThisMonth,
  getClickSnapshot,
  getTopClickedSongsThisMonth,
  getTopClickedLiveThisMonth,
  getTopClickHostsThisMonth,
  type DailyMetric,
} from "@/lib/analytics-stats";

export const dynamic = "force-dynamic";

function thisMonthLabel(): string {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

export default async function AnalyticsPage() {
  const [snap, daily, topPaths, topRefs, clickSnap, topSongs, topLives, topHosts] =
    await Promise.all([
      getSnapshot(),
      getDailyMetrics(30),
      getTopPathsThisMonth(20),
      getTopReferrersThisMonth(20),
      getClickSnapshot(),
      getTopClickedSongsThisMonth(20),
      getTopClickedLiveThisMonth(20),
      getTopClickHostsThisMonth(20),
    ]);

  const monthLabel = thisMonthLabel();

  return (
    <div className="space-y-10 max-w-5xl">
      <header>
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-4xl mb-2">
          Analytics
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          익명 페이지뷰 통계 — 봇 자동 제외, 매월 1일 자정에 방문자 신원 새로 생성 (개인정보 미보존).
        </p>
      </header>

      {/* Snapshot cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Stat
          label="Today views"
          value={snap.todayViews}
          sub={`Yesterday ${snap.yesterdayViews}`}
          hint="오늘 페이지가 로드된 총 횟수 (새로고침·재진입 모두 +1)"
        />
        <Stat
          label="Today visitors"
          value={snap.todayVisitors}
          sub={`Yesterday ${snap.yesterdayVisitors}`}
          hint="오늘 방문한 unique 사용자 수 (DAU). 한 사람이 여러 페이지를 봐도 1로 카운트."
        />
        <Stat
          label={`${monthLabel} views`}
          value={snap.thisMonthViews}
          hint="이번 달 1일부터 지금까지 누적 페이지뷰"
        />
        <Stat
          label={`${monthLabel} visitors`}
          value={snap.thisMonthVisitors}
          hint="이번 달 unique 사용자 수. 월 회전 솔트로 동일인은 같은 신원 → 정확."
        />
      </section>

      {/* Daily chart */}
      <section>
        <h2 className="text-sm uppercase tracking-wider font-semibold mb-1">Last 30 days trend</h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          하루 단위 페이지뷰와 그날의 unique 방문자 수 (각 점은 그날의 DAU).
        </p>
        <DailyChart data={daily} />
      </section>

      {/* Top paths */}
      <section>
        <h2 className="text-sm uppercase tracking-wider font-semibold mb-1">
          Top paths · {monthLabel}
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          이번 달 가장 많이 본 페이지. <strong>Visitors</strong>는 그 페이지를 본 unique 사용자.
        </p>
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
        <h2 className="text-sm uppercase tracking-wider font-semibold mb-1">
          Top referrers · {monthLabel}
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          외부 사이트(검색·SNS·뉴스 등)에서 클릭해 들어온 출처. 직접 URL 입력이나 사이트 내부 이동은 잡히지 않습니다.
        </p>
        {topRefs.length === 0 ? (
          <Empty hint="아직 외부 유입이 기록되지 않았습니다." />
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

      {/* Click events divider */}
      <section className="border-t border-[var(--color-border)] pt-10">
        <h2 className="font-display font-bold text-2xl md:text-3xl uppercase tracking-tight mb-2">
          Click events
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          외부 링크 클릭 (곡 Listen 버튼, 라이브 Tickets/Video 등). 페이지뷰와 별개로 측정 — 사용자가 실제로 행동했는지 보여줍니다.
        </p>
      </section>

      {/* Click snapshot */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <Stat
          label="Today clicks"
          value={clickSnap.todayClicks}
          hint="오늘 외부 링크가 클릭된 총 횟수"
        />
        <Stat
          label={`${monthLabel} clicks`}
          value={clickSnap.thisMonthClicks}
          hint="이번 달 외부 링크 클릭 누적"
        />
        <Stat
          label={`${monthLabel} unique clickers`}
          value={clickSnap.thisMonthUniqueClickers}
          hint="이번 달 한 번이라도 클릭한 unique 사용자"
        />
      </section>

      {/* Top clicked songs */}
      <section>
        <h2 className="text-sm uppercase tracking-wider font-semibold mb-1">
          Top clicked songs · {monthLabel}
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          곡 카드의 Listen 버튼 클릭 수. 어떤 곡이 실제로 들리는지의 직접 신호.
        </p>
        {topSongs.length === 0 ? (
          <Empty hint="아직 곡 Listen 클릭 기록이 없습니다." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-text-muted)]">
                <th className="py-2 pr-4">Song</th>
                <th className="py-2 pr-4 w-24 text-right">Clicks</th>
                <th className="py-2 w-28 text-right">Unique</th>
              </tr>
            </thead>
            <tbody>
              {topSongs.map((s) => (
                <tr key={s.songId} className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-4">{s.title}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{s.clicks}</td>
                  <td className="py-2 text-right tabular-nums text-[var(--color-text-muted)]">
                    {s.uniqueClickers}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Top clicked live events */}
      <section>
        <h2 className="text-sm uppercase tracking-wider font-semibold mb-1">
          Top clicked live events · {monthLabel}
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          라이브 카드의 Tickets / Video 버튼 클릭 수.
        </p>
        {topLives.length === 0 ? (
          <Empty hint="아직 라이브 클릭 기록이 없습니다." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-text-muted)]">
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4 w-28">Date</th>
                <th className="py-2 pr-4 w-24 text-right">Clicks</th>
                <th className="py-2 w-28 text-right">Unique</th>
              </tr>
            </thead>
            <tbody>
              {topLives.map((l) => (
                <tr key={l.liveId} className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-4">
                    {l.venue}
                    <span className="text-[var(--color-text-muted)] ml-2">· {l.city}</span>
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-[var(--color-text-muted)]">
                    {l.eventDate}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{l.clicks}</td>
                  <td className="py-2 text-right tabular-nums text-[var(--color-text-muted)]">
                    {l.uniqueClickers}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Top click destinations */}
      <section>
        <h2 className="text-sm uppercase tracking-wider font-semibold mb-1">
          Top click destinations · {monthLabel}
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          외부 링크 도메인 분포 (youtube.com, spotify.com, melon.com 등). 어디로 더 많이 빠져나가는지.
        </p>
        {topHosts.length === 0 ? (
          <Empty />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-text-muted)]">
                <th className="py-2 pr-4">Destination</th>
                <th className="py-2 pr-4 w-24 text-right">Clicks</th>
                <th className="py-2 w-28 text-right">Unique</th>
              </tr>
            </thead>
            <tbody>
              {topHosts.map((h) => (
                <tr key={h.targetHost} className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-4">{h.targetHost}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{h.clicks}</td>
                  <td className="py-2 text-right tabular-nums text-[var(--color-text-muted)]">
                    {h.uniqueClickers}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Glossary */}
      <Glossary />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  hint,
}: {
  label: string;
  value: number;
  sub?: string;
  hint?: string;
}) {
  return (
    <div className="border border-[var(--color-border)] p-4" title={hint}>
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

function Glossary() {
  const items: Array<{ term: string; def: string }> = [
    {
      term: "Page view (Views)",
      def: "페이지가 한 번 로드될 때마다 1. 같은 사람이 새로고침하거나 다시 방문하면 매번 추가됨.",
    },
    {
      term: "Today/Yesterday visitors (DAU)",
      def: "그날 사이트를 본 unique 사용자. 한 사람이 5개 페이지를 봐도 1로 카운트.",
    },
    {
      term: "This month visitors",
      def: "이번 달 1일부터 지금까지 unique 사용자. 같은 달 안에서는 동일인이 같은 신원으로 인식되므로 정확.",
    },
    {
      term: "Source / Ref host",
      def: "외부 사이트에서 클릭해 들어온 출처 도메인 (예: google.com, instagram.com). 검색·SNS·뉴스 등 유입 경로 파악용. 직접 URL 입력이나 사이트 내부 이동은 빈 값.",
    },
    {
      term: "방문자 식별 방식",
      def: "IP + 브라우저(UA) + 이번 달 솔트의 sha256 해시. 한 달이 지나면 같은 사람도 새 신원으로 카운트됨 (PIPA 보수적, 영구 추적 불가).",
    },
    {
      term: "봇 자동 제외",
      def: "googlebot, bingbot, naverbot/yeti, baidu, GPTBot, ClaudeBot, PerplexityBot 등 24개 패턴은 INSERT 자체를 안 함 (테이블 비대 방지).",
    },
    {
      term: "측정 방식",
      def: "페이지가 클라이언트에서 hydrate된 후 JS가 직접 /api/analytics/log를 호출. prefetch RSC fetch는 JS를 실행하지 않으므로 자동 제외. JS를 실행하지 않는 봇도 자동 제외. F5 연타 같은 노이즈는 DB 레벨 5분 윈도우로 흡수.",
    },
    {
      term: "Click events",
      def: "외부 링크(<a href> 외부 도메인)를 사용자가 클릭하면 별도 테이블(analytics_clicks)에 기록. 곡 카드의 Listen 버튼과 라이브 카드의 Tickets/Video 버튼에 data-track-item-{type,id} 속성이 붙어있어 어떤 곡/라이브인지까지 식별. 5초 안 더블클릭은 1번으로 흡수.",
    },
    {
      term: "Page view vs Click 차이",
      def: "Page view = 사람이 페이지를 봤다 (수동적 노출). Click = 사람이 외부로 행동했다 (능동적 의도). 같은 곡이 페이지뷰는 많은데 Listen 클릭이 적으면 카드 디자인·CTA 문제일 수 있음.",
    },
    {
      term: "5분 dedup 윈도우",
      def: "같은 사용자가 같은 페이지를 5분 안에 여러 번 보면 1번으로 카운트. F5 연타·짧은 세션 내 재방문 노이즈 흡수용. 5분이 지나서 다시 본 경우는 새로 카운트.",
    },
    {
      term: "주의: cross-month 윈도우",
      def: "두 달에 걸친 윈도우에서 unique visitor 수는 같은 사람을 2번 셀 수 있음 (월 1일에 신원이 새로 생성되기 때문). 월별로 보는 게 가장 정확.",
    },
  ];
  return (
    <section className="border-t border-[var(--color-border)] pt-6">
      <h2 className="text-sm uppercase tracking-wider font-semibold mb-4">지표 설명</h2>
      <dl className="space-y-3 text-xs text-[var(--color-text-muted)] max-w-3xl">
        {items.map((it) => (
          <div key={it.term}>
            <dt className="font-semibold text-[var(--color-text)] inline">{it.term}</dt>
            <dd className="inline"> — {it.def}</dd>
          </div>
        ))}
      </dl>
    </section>
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
      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)] mb-3 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] bg-[var(--color-accent)]" /> Daily views
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] bg-[var(--color-text)]" /> Daily visitors (DAU)
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
