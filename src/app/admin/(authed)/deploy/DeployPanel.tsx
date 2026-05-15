"use client";
import { useMemo, useState } from "react";

type Row = {
  jobId: string;
  actor: string;
  kind: "deploy" | "rollback";
  preHead: string | null;
  postHead: string | null;
  status: "running" | "success" | "fail" | "interrupted";
  failStep: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
};

type Diff = {
  head: string;
  remote: string;
  ahead: number;
  behind: number;
  commits: { hash: string; subject: string }[];
  fetchedAt: string;
};

export default function DeployPanel(props: {
  initialHead: string;
  initialHeadSubject: string;
  initialRecent: Row[];
  initialRunningJobId: string | null;
  rollbackCandidateHash: string | null;
}) {
  const [diff, setDiff] = useState<Diff | null>(null);
  const [recent, setRecent] = useState<Row[]>(props.initialRecent);
  const [runningJobId, setRunningJobId] = useState<string | null>(props.initialRunningJobId);
  const [activeJobId, setActiveJobId] = useState<string | null>(props.initialRunningJobId);
  const [logText, setLogText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRollback = useMemo(() => Boolean(props.rollbackCandidateHash), [props.rollbackCandidateHash]);

  // Stubs filled in Task 17.
  const onDiff = async () => { /* Task 17 */ };
  const onDeploy = async () => { /* Task 17 */ };
  const onRollback = async () => { /* Task 17 */ };

  // Suppress unused-var TS warnings in this no-action stage.
  void diff; void setDiff; void recent; void setRecent;
  void runningJobId; void setRunningJobId; void activeJobId; void setActiveJobId;
  void logText; void setLogText; void busy; void setBusy; void error; void setError;
  void onDiff; void onDeploy; void onRollback; void canRollback;

  return (
    <div className="space-y-8">
      <section className="border border-[var(--color-border)] p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold uppercase tracking-wider text-sm">Remote Status</h2>
          <button
            type="button"
            onClick={onDiff}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border border-[var(--color-text)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg-muted)]"
          >
            Diff 새로고침
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">아직 diff 를 불러오지 않았습니다.</p>
      </section>

      <section className="flex flex-col md:flex-row gap-3">
        <button
          type="button"
          onClick={onDeploy}
          className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors"
        >
          ▶ 운영에 반영 (origin/main → 서버)
        </button>
        <button
          type="button"
          onClick={onRollback}
          disabled={!canRollback}
          className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↩ 이전 버전으로 롤백
        </button>
      </section>

      <section className="border border-[var(--color-border)] p-4 md:p-6">
        <h2 className="font-semibold uppercase tracking-wider text-sm">진행 로그</h2>
        <pre className="mt-3 text-xs font-mono bg-[var(--color-bg-muted)] p-3 overflow-auto max-h-72">
{logText || "(진행 중인 배포 없음)"}
        </pre>
      </section>

      <section>
        <h2 className="font-semibold uppercase tracking-wider text-sm">최근 배포 이력</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[var(--color-text-muted)] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 pr-3">시각</th>
                <th className="text-left py-2 pr-3">종류</th>
                <th className="text-left py-2 pr-3">pre → post</th>
                <th className="text-left py-2 pr-3">actor</th>
                <th className="text-left py-2 pr-3">결과</th>
                <th className="text-left py-2 pr-3">시간</th>
                <th className="text-left py-2 pr-3">jobId</th>
              </tr>
            </thead>
            <tbody>
              {props.initialRecent.map((r) => (
                <tr key={r.jobId} className="border-t border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-mono">{r.startedAt.slice(0, 19).replace("T", " ")}</td>
                  <td className="py-2 pr-3">{r.kind}</td>
                  <td className="py-2 pr-3 font-mono">{(r.preHead ?? "-").slice(0,7)} → {(r.postHead ?? "-").slice(0,7)}</td>
                  <td className="py-2 pr-3">{r.actor}</td>
                  <td className="py-2 pr-3">
                    <span className={r.status === "success" ? "text-[var(--color-text)]" : r.status === "fail" ? "text-red-700" : "text-[var(--color-text-muted)]"}>
                      {r.status}{r.failStep ? ` (${r.failStep})` : ""}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{r.durationSec != null ? `${r.durationSec}s` : "-"}</td>
                  <td className="py-2 pr-3 font-mono">{r.jobId}</td>
                </tr>
              ))}
              {props.initialRecent.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-[var(--color-text-muted)]">이력 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
