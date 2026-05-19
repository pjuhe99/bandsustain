"use client";

import { useEffect, useMemo, useState } from "react";

type VoiceCorpusEntry = {
  category: string;
  user: string;
  assistant: string;
  notes: string[];
};

const EMPTY_ENTRY: VoiceCorpusEntry = {
  category: "",
  user: "",
  assistant: "",
  notes: [""],
};

const EXAMPLE_ENTRY: VoiceCorpusEntry = {
  category: "공연일정 질문",
  user: "다음 공연 언제예요?",
  assistant:
    "그건 지금 내가 확답하면 좀 위험하고\n공식으로 뜬 거 있으면 그게 정사임\nLIVE 쪽 보는 게 맞음",
  notes: ["모르면 지어내지 않음", "정사/야사 비유", "공식 정보로 유도"],
};

function normalizeEntries(entries: VoiceCorpusEntry[]): VoiceCorpusEntry[] {
  return entries.map((entry) => ({
    category: entry.category ?? "",
    user: entry.user ?? "",
    assistant: entry.assistant ?? "",
    notes: Array.isArray(entry.notes) && entry.notes.length > 0 ? entry.notes : [""],
  }));
}

function parseEntries(raw: unknown): VoiceCorpusEntry[] {
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeEntries(
      parsed.filter((entry): entry is VoiceCorpusEntry => {
        if (typeof entry !== "object" || entry === null) return false;
        const value = entry as Record<string, unknown>;
        return (
          typeof value.category === "string" &&
          typeof value.user === "string" &&
          typeof value.assistant === "string" &&
          Array.isArray(value.notes) &&
          value.notes.every((note) => typeof note === "string")
        );
      }),
    );
  } catch {
    return [];
  }
}

export default function YeongminBotCorpusPage() {
  const [entries, setEntries] = useState<VoiceCorpusEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/admin/yeongmin-bot/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const nextEntries = parseEntries(data.voiceCorpusJson);
        setEntries(
          nextEntries.length > 0
            ? [...nextEntries].reverse()
            : [{ ...EXAMPLE_ENTRY }],
        );
      })
      .catch(() => setErr("로드 실패"));
  }, []);

  const jsonPreview = useMemo(
    () => JSON.stringify(normalizeEntries([...entries].reverse()), null, 2),
    [entries],
  );

  function updateEntry(index: number, patch: Partial<VoiceCorpusEntry>) {
    setEntries((current) =>
      current.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function updateNote(entryIndex: number, noteIndex: number, value: string) {
    setEntries((current) =>
      current.map((entry, currentEntryIndex) => {
        if (currentEntryIndex !== entryIndex) return entry;
        return {
          ...entry,
          notes: entry.notes.map((note, currentNoteIndex) =>
            currentNoteIndex === noteIndex ? value : note,
          ),
        };
      }),
    );
  }

  function addEntry() {
    setEntries((current) => [{ ...EMPTY_ENTRY, notes: [""] }, ...current]);
  }

  function removeEntry(index: number) {
    setEntries((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function addNote(entryIndex: number) {
    setEntries((current) =>
      current.map((entry, currentIndex) =>
        currentIndex === entryIndex ? { ...entry, notes: [...entry.notes, ""] } : entry,
      ),
    );
  }

  function removeNote(entryIndex: number, noteIndex: number) {
    setEntries((current) =>
      current.map((entry, currentIndex) => {
        if (currentIndex !== entryIndex) return entry;
        const nextNotes = entry.notes.filter((_, currentNoteIndex) => currentNoteIndex !== noteIndex);
        return { ...entry, notes: nextNotes.length > 0 ? nextNotes : [""] };
      }),
    );
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/yeongmin-bot/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          voiceCorpusJson: jsonPreview,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "저장 실패");
        return;
      }
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="border border-[var(--color-border)] p-4 md:p-5 flex flex-col gap-2 text-sm">
        <p className="font-semibold">Corpus format</p>
        <p className="text-[var(--color-text-muted)]">
          각 예시는 `category`, `user`, `assistant`, `notes[]` 네 칸으로 저장됩니다.
          실제 카톡 로그를 길게 붙이는 것보다, 짧고 선명한 상황별 예시를 여러 개 넣는 편이 더 잘 먹힙니다.
        </p>
      </section>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={addEntry}
          className="px-5 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)]"
        >
          Add example
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] disabled:opacity-50"
        >
          {saving ? "Saving.." : "Save corpus"}
        </button>
        {savedAt && <span className="text-sm text-[var(--color-text-muted)]">저장됨: {savedAt}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      <div className="flex flex-col gap-5">
        {entries.map((entry, entryIndex) => (
          <section
            key={entryIndex}
            className="border border-[var(--color-border)] p-4 md:p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-wider">
                Example {entryIndex + 1}
              </p>
              <button
                onClick={() => removeEntry(entryIndex)}
                disabled={entries.length === 1}
                className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold">Category</label>
              <input
                value={entry.category}
                onChange={(e) => updateEntry(entryIndex, { category: e.target.value })}
                className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                placeholder="예: 공연일정 질문"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold">User</label>
              <textarea
                value={entry.user}
                onChange={(e) => updateEntry(entryIndex, { user: e.target.value })}
                rows={3}
                className="w-full resize-y border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                placeholder="사용자 질문"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold">Assistant</label>
              <textarea
                value={entry.assistant}
                onChange={(e) => updateEntry(entryIndex, { assistant: e.target.value })}
                rows={5}
                className="w-full resize-y border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm font-mono"
                placeholder="김영민봇이 따라갈 답변"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold">Notes</label>
                <button
                  onClick={() => addNote(entryIndex)}
                  className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  Add note
                </button>
              </div>
              {entry.notes.map((note, noteIndex) => (
                <div key={noteIndex} className="flex items-center gap-2">
                  <input
                    value={note}
                    onChange={(e) => updateNote(entryIndex, noteIndex, e.target.value)}
                    className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                    placeholder="예: 짧게 끊음"
                  />
                  <button
                    onClick={() => removeNote(entryIndex, noteIndex)}
                    className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)]">
          JSON preview
        </h2>
        <pre className="border border-[var(--color-border)] p-4 text-xs whitespace-pre-wrap font-mono bg-[var(--color-bg-muted)] max-h-[60vh] overflow-y-auto">
          {jsonPreview}
        </pre>
      </section>
    </div>
  );
}
