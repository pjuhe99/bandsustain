"use client";
import { useCallback, useEffect, useRef, useState } from "react";

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

type LogResponse = {
  jobId: string;
  row: { status: Row["status"]; fail_step: string | null } | null;
  log: string;
  parsed: { result: { status: "success" | "fail" | "interrupted" } | null };
};

const POLL_MS = 2000;

export default function DeployPanel(props: {
  initialHead: string;
  initialHeadSubject: string;
  initialRecent: Row[];
  initialRunningJobId: string | null;
  rollbackCandidateHash: string | null;
}) {
  const [diff, setDiff] = useState<Diff | null>(null);
  const [recent, setRecent] = useState<Row[]>(props.initialRecent);
  const [activeJobId, setActiveJobId] = useState<string | null>(props.initialRunningJobId);
  const [logText, setLogText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = useCallback(async () => {
    const r = await fetch("/api/admin/deploy/history", { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { rows: Row[] };
      setRecent(j.rows);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const pollOnce = useCallback(async (jobId: string) => {
    try {
      const r = await fetch(`/api/admin/deploy/${jobId}/log`, { cache: "no-store" });
      if (!r.ok) {
        pollTimerRef.current = setTimeout(() => pollOnce(jobId), POLL_MS);
        return;
      }
      const j = (await r.json()) as LogResponse;
      setLogText(j.log);
      const finished =
        (j.row && (j.row.status === "success" || j.row.status === "fail" || j.row.status === "interrupted")) ||
        Boolean(j.parsed.result);
      if (finished) {
        stopPolling();
        setActiveJobId(null);
        await fetchHistory();
      } else {
        pollTimerRef.current = setTimeout(() => pollOnce(jobId), POLL_MS);
      }
    } catch {
      pollTimerRef.current = setTimeout(() => pollOnce(jobId), POLL_MS);
    }
  }, [fetchHistory, stopPolling]);

  const onDiff = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/deploy/diff", { method: "POST" });
      if (!r.ok) throw new Error((await r.text()) || "diff failed");
      setDiff((await r.json()) as Diff);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const onDeploy = useCallback(async () => {
    if (!confirm("origin/main 을 운영에 반영합니다. 진행할까요?")) return;
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/deploy", { method: "POST" });
      const j = (await r.json()) as { jobId?: string; error?: string };
      if (r.status === 409 && j.jobId) {
        setActiveJobId(j.jobId);
        pollOnce(j.jobId);
        return;
      }
      if (!r.ok || !j.jobId) throw new Error(j.error || "deploy failed");
      setActiveJobId(j.jobId);
      setLogText("");
      pollOnce(j.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [pollOnce]);

  const onRollback = useCallback(async () => {
    if (!props.rollbackCandidateHash) return;
    const target = props.rollbackCandidateHash;
    if (!confirm(`이전 안정 버전 ${target.slice(0,7)} 로 롤백합니다. 진행할까요?`)) return;
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/deploy/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_hash: target }),
      });
      const j = (await r.json()) as { jobId?: string; error?: string };
      if (r.status === 409 && j.jobId) {
        setActiveJobId(j.jobId);
        pollOnce(j.jobId);
        return;
      }
      if (!r.ok || !j.jobId) throw new Error(j.error || "rollback failed");
      setActiveJobId(j.jobId);
      setLogText("");
      pollOnce(j.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [pollOnce, props.rollbackCandidateHash]);

  useEffect(() => {
    if (props.initialRunningJobId) pollOnce(props.initialRunningJobId);
    return () => stopPolling();
  }, [pollOnce, props.initialRunningJobId, stopPolling]);

  return (
    <div className="space-y-8">
      <section className="border border-[var(--color-border)] p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold uppercase tracking-wider text-sm">Remote Status</h2>
          <button
            type="button"
            onClick={onDiff}
            disabled={busy}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border border-[var(--color-text)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg-muted)] disabled:opacity-40"
          >
            Diff 새로고침
          </button>
        </div>
        {diff ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              HEAD <code className="font-mono">{diff.head.slice(0,7)}</code> ↔ origin/main <code className="font-mono">{diff.remote.slice(0,7)}</code>{" "}
              · ahead <b>{diff.ahead}</b> · behind <b>{diff.behind}</b>
            </p>
            {diff.commits.length > 0 ? (
              <ul className="font-mono text-xs space-y-1">
                {diff.commits.map((c) => (
                  <li key={c.hash}><code>{c.hash}</code> {c.subject}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[var(--color-text-muted)]">변경 없음 (이미 최신).</p>
            )}
            <p className="text-xs text-[var(--color-text-muted)]">fetched {new Date(diff.fetchedAt).toLocaleString()}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">[Diff 새로고침] 을 눌러 origin/main 상태를 확인하세요.</p>
        )}
      </section>

      {error && (
        <div className="border border-red-700 bg-red-50 text-red-800 p-3 text-sm">{error}</div>
      )}

      <section className="flex flex-col md:flex-row gap-3">
        <button
          type="button"
          onClick={onDeploy}
          disabled={busy || Boolean(activeJobId)}
          className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ▶ 운영에 반영 (origin/main → 서버)
        </button>
        <button
          type="button"
          onClick={onRollback}
          disabled={busy || Boolean(activeJobId) || !props.rollbackCandidateHash}
          className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↩ 이전 버전으로 롤백 {props.rollbackCandidateHash ? `(${props.rollbackCandidateHash.slice(0,7)})` : ""}
        </button>
      </section>

      <section className="border border-[var(--color-border)] p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold uppercase tracking-wider text-sm">
            진행 로그 {activeJobId ? <code className="ml-2 font-mono text-xs">{activeJobId}</code> : null}
          </h2>
          {activeJobId && (
            <span className="text-xs text-[var(--color-text-muted)]">2초마다 자동 갱신</span>
          )}
        </div>
        <pre className="mt-3 text-xs font-mono bg-[var(--color-bg-muted)] p-3 overflow-auto max-h-72 whitespace-pre">
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
              {recent.map((r) => (
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
              {recent.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-[var(--color-text-muted)]">이력 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
