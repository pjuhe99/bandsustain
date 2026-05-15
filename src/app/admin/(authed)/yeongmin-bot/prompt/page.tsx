"use client";

import { useEffect, useState } from "react";

type Sections = {
  sectionIdentity: string;
  sectionRole: string;
  sectionTone: string;
  sectionPersonality: string;
  sectionKnowledge: string;
  sectionLikes: string;
  sectionDislikes: string;
  sectionForbidden: string;
  sectionUnknownHandling: string;
  sectionExamples: string;
};

const SECTION_LABELS: Array<{ key: keyof Sections; label: string }> = [
  { key: "sectionIdentity", label: "1. 정체성" },
  { key: "sectionRole", label: "2. 역할" },
  { key: "sectionTone", label: "3. 말투" },
  { key: "sectionPersonality", label: "4. 성격" },
  { key: "sectionKnowledge", label: "5. 주요 지식" },
  { key: "sectionLikes", label: "6. 좋아하는 것" },
  { key: "sectionDislikes", label: "7. 싫어하는 것" },
  { key: "sectionForbidden", label: "8. 금지사항" },
  { key: "sectionUnknownHandling", label: "9. 모르는 질문 대응 방식" },
  { key: "sectionExamples", label: "10. 답변 예시" },
];

const HEADER_TEXT =
  '너는 밴드 서스테인의 리더 김영민을 모티브로 만든 AI 캐릭터 챗봇이다. 실제 김영민 본인은 아니며, 카카오톡 대화에서 보이는 김영민의 말투와 농담 방식, 음악/기타 장비/역사 지식을 참고해 대화한다.\n\n이 봇의 목적은 밴드 홍보보다 "진짜 김영민과 카톡하는 것 같은 재미"를 주는 것이다.';

function assemblePreview(s: Sections): string {
  const parts: string[] = [HEADER_TEXT];
  for (const { key, label } of SECTION_LABELS) {
    const value = s[key];
    if (value.trim().length > 0) {
      parts.push(`## ${label}\n${value.trim()}`);
    }
  }
  return parts.join("\n\n");
}

export default function PromptEditorPage() {
  const [sections, setSections] = useState<Sections | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    fetch("/api/admin/yeongmin-bot/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const s: Sections = {
          sectionIdentity: data.sectionIdentity ?? "",
          sectionRole: data.sectionRole ?? "",
          sectionTone: data.sectionTone ?? "",
          sectionPersonality: data.sectionPersonality ?? "",
          sectionKnowledge: data.sectionKnowledge ?? "",
          sectionLikes: data.sectionLikes ?? "",
          sectionDislikes: data.sectionDislikes ?? "",
          sectionForbidden: data.sectionForbidden ?? "",
          sectionUnknownHandling: data.sectionUnknownHandling ?? "",
          sectionExamples: data.sectionExamples ?? "",
        };
        setSections(s);
      })
      .catch(() => setErr("로드 실패"));
  }, []);

  async function save() {
    if (!sections) return;
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/yeongmin-bot/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sections),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "저장 실패");
      } else {
        setSavedAt(new Date().toLocaleTimeString("ko-KR"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (!sections) return <p className="text-[var(--color-text-muted)]">로딩 중...</p>;

  return (
    <div className="flex flex-col gap-6">
      {SECTION_LABELS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-2">
          <label className="text-sm font-semibold">{label}</label>
          <textarea
            value={sections[key]}
            onChange={(e) => setSections({ ...sections, [key]: e.target.value })}
            rows={key === "sectionExamples" ? 14 : 6}
            className="w-full resize-y border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm font-mono"
          />
        </div>
      ))}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        <button
          onClick={() => setPreviewOpen((v) => !v)}
          className="px-5 py-2.5 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)]"
        >
          {previewOpen ? "미리보기 닫기" : "머지 미리보기"}
        </button>
        {savedAt && <span className="text-sm text-[var(--color-text-muted)]">저장됨: {savedAt}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      {previewOpen && (
        <pre className="border border-[var(--color-border)] p-4 text-xs whitespace-pre-wrap font-mono bg-[var(--color-bg-muted)] max-h-[60vh] overflow-y-auto">
          {assemblePreview(sections)}
        </pre>
      )}
    </div>
  );
}
