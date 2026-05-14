"use client";

import { useEffect, useState } from "react";

type SettingsView = {
  modelName: string;
  inputRatePer1mUsd: number;
  outputRatePer1mUsd: number;
  dailyTokenCap: number;
  sessionMsgCap: number;
  apiKeyConfigured: boolean;
};

const MODEL_OPTIONS = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"];

export default function ApiKeyPage() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [newKey, setNewKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    fetch("/api/admin/youngmin-bot/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setView(d))
      .catch(() => setErr("로드 실패"));
  }

  async function saveKey() {
    if (newKey.length < 20) {
      setErr("API 키가 너무 짧음");
      return;
    }
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/youngmin-bot/api-key", {
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
      const res = await fetch("/api/admin/youngmin-bot/settings", {
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
          OpenAI API 키
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
          className="self-start px-5 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] disabled:opacity-50"
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
            <option key={m} value={m}>{m}</option>
          ))}
          {!MODEL_OPTIONS.includes(view.modelName) && (
            <option value={view.modelName}>{view.modelName}</option>
          )}
        </select>
        <p className="text-xs text-[var(--color-text-muted)]">
          모델 변경 시 입출력 단가도 함께 갱신해야 비용 표시가 정확해요.
        </p>
        <button
          onClick={() => saveSettings({ modelName: view.modelName })}
          disabled={saving}
          className="self-start px-5 py-2.5 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] disabled:opacity-50"
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
          className="self-start px-5 py-2.5 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] disabled:opacity-50"
        >
          단가 저장
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)]">한도</h2>
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
          className="self-start px-5 py-2.5 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] disabled:opacity-50"
        >
          한도 저장
        </button>
      </section>

      <div className="flex gap-3 text-sm">
        {msg && <span className="text-[var(--color-text-muted)]">{msg}</span>}
        {err && <span className="text-red-600">{err}</span>}
      </div>
    </div>
  );
}
