import { getSettings, getUsageKpis, listRecentSessions } from "@/lib/yeongminBot";

export const dynamic = "force-dynamic";

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export default async function YeongminBotDashboard() {
  const [settings, kpis, sessions] = await Promise.all([
    getSettings(),
    getUsageKpis(),
    listRecentSessions(50),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="오늘 토큰" value={fmtNum(kpis.todayTokens)} />
        <Kpi label="오늘 비용" value={fmtUsd(kpis.todayCostUsd)} />
        <Kpi label="이번 달 비용" value={fmtUsd(kpis.monthCostUsd)} />
        <Kpi label="누적 총 비용" value={fmtUsd(kpis.allTimeCostUsd)} />
      </section>

      <section className="text-sm text-[var(--color-text-muted)] flex flex-wrap gap-x-6 gap-y-1">
        <span>모델: <span className="text-[var(--color-text)]">{settings.modelName}</span></span>
        <span>일일 토큰 한도: <span className="text-[var(--color-text)]">{fmtNum(settings.dailyTokenCap)}</span></span>
        <span>세션 메시지 한도: <span className="text-[var(--color-text)]">{settings.sessionMsgCap}</span></span>
        <span>입력 단가: <span className="text-[var(--color-text)]">{fmtUsd(settings.inputRatePer1mUsd)} / 1M</span></span>
        <span>출력 단가: <span className="text-[var(--color-text)]">{fmtUsd(settings.outputRatePer1mUsd)} / 1M</span></span>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
          최근 50 세션
        </h2>
        {sessions.length === 0 ? (
          <p className="text-[var(--color-text-muted)] text-sm">아직 대화 기록 없음.</p>
        ) : (
          <div className="overflow-x-auto border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-muted)]">
                <tr>
                  <th className="text-left px-3 py-2">Session</th>
                  <th className="text-left px-3 py-2">시작</th>
                  <th className="text-left px-3 py-2">마지막</th>
                  <th className="text-right px-3 py-2">턴</th>
                  <th className="text-right px-3 py-2">In tok</th>
                  <th className="text-right px-3 py-2">Out tok</th>
                  <th className="text-right px-3 py-2">비용</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.sessionId} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-mono text-xs">{s.sessionId.slice(0, 8)}</td>
                    <td className="px-3 py-2">{fmtDateTime(s.startedAt)}</td>
                    <td className="px-3 py-2">{fmtDateTime(s.lastActivity)}</td>
                    <td className="px-3 py-2 text-right">{s.msgCount}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(s.sumInputTokens)}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(s.sumOutputTokens)}</td>
                    <td className="px-3 py-2 text-right">{fmtUsd(s.sumCostUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--color-border)] p-4 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      <span className="font-display font-bold text-xl md:text-2xl">{value}</span>
    </div>
  );
}
