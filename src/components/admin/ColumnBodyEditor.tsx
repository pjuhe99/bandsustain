"use client";
import { useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import { uploadImage } from "@/lib/upload";

function Btn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)]"
    >
      {label}
    </button>
  );
}

export default function ColumnBodyEditor({
  name,
  initialValue,
}: {
  name: string;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function surround(before: string, after = "") {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end);
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + sel.length;
    });
  }

  function insertAtCursor(text: string) {
    const ta = taRef.current;
    const pos = ta ? ta.selectionStart : value.length;
    setValue(value.slice(0, pos) + text + value.slice(pos));
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await uploadImage(fd, "columns");
      if (res.ok) {
        insertAtCursor(`\n\n![${f.name}](${res.path})\n\n`);
      } else {
        setError(res.error);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-1.5 items-center">
        <Btn label="H2" onClick={() => surround("\n## ", "")} />
        <Btn label="H3" onClick={() => surround("\n### ", "")} />
        <Btn label="굵게" onClick={() => surround("**", "**")} />
        <Btn label="기울임" onClick={() => surround("_", "_")} />
        <Btn label="인용" onClick={() => surround("\n> ", "")} />
        <Btn label="• 목록" onClick={() => surround("\n- ", "")} />
        <Btn label="1. 목록" onClick={() => surround("\n1. ", "")} />
        <Btn label="링크" onClick={() => surround("[", "](https://)")} />
        <Btn label="구분선" onClick={() => insertAtCursor("\n\n---\n\n")} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-2 py-1 text-xs border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)] disabled:opacity-50"
        >
          {uploading ? "업로드 중…" : "이미지"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onPickImage}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className={
            "ml-auto px-2 py-1 text-xs border border-[var(--color-border-strong)] " +
            (preview ? "bg-[var(--color-text)] text-[var(--color-bg)]" : "hover:bg-[var(--color-bg-muted)]")
          }
        >
          {preview ? "편집" : "미리보기"}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--color-accent)]">{error}</p>}
      {preview ? (
        <div className="border border-[var(--color-border-strong)] px-4 py-3 min-h-[20rem]">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-[var(--color-text-muted)]">미리볼 내용이 없습니다.</p>}
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={25}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] text-sm leading-relaxed font-mono"
          placeholder="마크다운으로 작성하세요. 이미지는 위 '이미지' 버튼으로 첨부합니다."
        />
      )}
    </div>
  );
}
