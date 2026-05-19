"use client";

import { useEffect, useState } from "react";

type SettingsView = {
  modelName: string;
  inputRatePer1mUsd: number;
  outputRatePer1mUsd: number;
  dailyTokenCap: number;
  sessionMsgCap: number;
  inputCharLimit: number;
  longInputFallbackReply: string | null;
  outputMaxChars: number;
  outputMaxLines: number;
  outputMaxTokens: number;
  apiKeyConfigured: boolean;
};

const MODEL_OPTIONS = ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4.1", "gpt-4o", "o4-mini", "gpt-4-turbo"];

export default function ApiKeyPage() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [newKey, setNewKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const refresh = () => {
    fetch("/api/admin/yeongmin-bot/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setView(d))
      .catch(() => setErr("로드 실패"));
  };

  useEffect(() => {
    refresh();
  }, []);

  async function saveKey() {
    if (newKey.length < 20) {
      setErr("API 키가 너무 짧습니다.");
      return;
    }
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/yeongmin-bot/api-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: newKey }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "저장 실패");
      } else {
        setMsg("저장됨");
        setNewKey("");
        refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings(patch: Partial<SettingsView>) {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/yeongmin-bot/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "저장 실패");
      } else {
        setMsg("저장됨");
        refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!view) return <p className="text-[var(--color-text-muted)]">로딩 중...</p>;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)]">
          OpenAI API Key
        </h2>
        <p className="text-sm">
          현재 상태:{" "}
          <span className={view.apiKeyConfigured ? "text-[var(--color-text)]" : "text-red-600"}>
            {view.apiKeyConfigured ? "설정됨" : "미설정"}
          </span>{" "}
          <span className="text-[var(--color-text-muted)] text-xs">(평문은 표시하지 않음)</span>
        </p>
        <input
          type="password"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="새 API 키 입력 (sk-...)"
          className="w-full max-w-xl border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm font-mono"
        />
        <button
          onClick={saveKey}
          disabled={saving}
          className="self-start border border-[var(--color-text)] bg-[var(--color-text)] px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-[var(--color-bg)] disabled:opacity-50"
        >
          {saving ? "저장 중..." : "API 키 저장 / 교체"}
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)]">모델</h2>
        <select
          value={view.modelName}
          onChange={(e) => setView({ ...view, modelName: e.target.value })}
          className="self-start border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          {!MODEL_OPTIONS.includes(view.modelName) && (
            <option value={view.modelName}>{view.modelName}</option>
          )}
        </select>
        <p className="text-xs text-[var(--color-text-muted)]">
          모델을 바꾸면 입력/출력 단가도 함께 갱신해야 비용 표시가 정확합니다.
        </p>
        <button
          onClick={() => saveSettings({ modelName: view.modelName })}
          disabled={saving}
          className="self-start border border-[var(--color-text)] bg-transparent px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-[var(--color-text)] disabled:opacity-50"
        >
          모델 저장
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)]">단가</h2>
        <label className="flex items-center gap-3 text-sm">
          <span className="w-32">입력 ($/1M)</span>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={view.inputRatePer1mUsd}
            onChange={(e) => setView({ ...view, inputRatePer1mUsd: Number(e.target.value) })}
            className="w-32 border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <span className="w-32">출력 ($/1M)</span>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={view.outputRatePer1mUsd}
            onChange={(e) => setView({ ...view, outputRatePer1mUsd: Number(e.target.value) })}
            className="w-32 border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1 text-sm"
          />
        </label>
        <button
          onClick={() =>
            saveSettings({
              inputRatePer1mUsd: view.inputRatePer1mUsd,
              outputRatePer1mUsd: view.outputRatePer1mUsd,
            })
          }
          disabled={saving}
          className="self-start border border-[var(--color-text)] bg-transparent px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-[var(--color-text)] disabled:opacity-50"
        >
          단가 저장
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)]">토큰 한도</h2>
        <label className="flex items-center gap-3 text-sm">
          <span className="w-40">일일 토큰 한도</span>
          <input
            type="number"
            step="1"
            min="0"
            value={view.dailyTokenCap}
            onChange={(e) => setView({ ...view, dailyTokenCap: Number(e.target.value) })}
            className="w-40 border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <span className="w-40">세션 메시지 한도</span>
          <input
            type="number"
            step="1"
            min="0"
            value={view.sessionMsgCap}
            onChange={(e) => setView({ ...view, sessionMsgCap: Number(e.target.value) })}
            className="w-40 border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1 text-sm"
          />
        </label>
        <button
          onClick={() =>
            saveSettings({
              dailyTokenCap: view.dailyTokenCap,
              sessionMsgCap: view.sessionMsgCap,
            })
          }
          disabled={saving}
          className="self-start border border-[var(--color-text)] bg-transparent px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-[var(--color-text)] disabled:opacity-50"
        >
          토큰 한도 저장
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)]">입출력 길이 제어</h2>
        <label className="flex items-center gap-3 text-sm">
          <span className="w-48">입력 글자수 한도</span>
          <input
            type="number"
            step="1"
            min="1"
            value={view.inputCharLimit}
            onChange={(e) => setView({ ...view, inputCharLimit: Number(e.target.value) })}
            className="w-40 border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <span className="w-48">출력 최대 글자수</span>
          <input
            type="number"
            step="1"
            min="1"
            value={view.outputMaxChars}
            onChange={(e) => setView({ ...view, outputMaxChars: Number(e.target.value) })}
            className="w-40 border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <span className="w-48">출력 최대 줄 수</span>
          <input
            type="number"
            step="1"
            min="1"
            value={view.outputMaxLines}
            onChange={(e) => setView({ ...view, outputMaxLines: Number(e.target.value) })}
            className="w-40 border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <span className="w-48">출력 최대 토큰</span>
          <input
            type="number"
            step="1"
            min="1"
            value={view.outputMaxTokens}
            onChange={(e) => setView({ ...view, outputMaxTokens: Number(e.target.value) })}
            className="w-40 border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>장문 입력 fallback 답변</span>
          <textarea
            value={view.longInputFallbackReply ?? ""}
            onChange={(e) => setView({ ...view, longInputFallbackReply: e.target.value })}
            rows={5}
            className="min-h-28 w-full max-w-3xl border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          />
        </label>
        <p className="text-xs text-[var(--color-text-muted)]">
          입력 한도를 넘기면 모델을 호출하지 않고 위 답변을 그대로 반환합니다. 출력은 프롬프트 규칙과 서버 후처리 둘 다 적용됩니다.
        </p>
        <button
          onClick={() =>
            saveSettings({
              inputCharLimit: view.inputCharLimit,
              outputMaxChars: view.outputMaxChars,
              outputMaxLines: view.outputMaxLines,
              outputMaxTokens: view.outputMaxTokens,
              longInputFallbackReply: view.longInputFallbackReply ?? "",
            })
          }
          disabled={saving}
          className="self-start border border-[var(--color-text)] bg-transparent px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-[var(--color-text)] disabled:opacity-50"
        >
          길이 제어 저장
        </button>
      </section>

      <div className="flex gap-3 text-sm">
        {msg && <span className="text-[var(--color-text-muted)]">{msg}</span>}
        {err && <span className="text-red-600">{err}</span>}
      </div>
    </div>
  );
}
