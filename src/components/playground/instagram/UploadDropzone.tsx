"use client";
import { useRef, useState, type DragEvent } from "react";
import { buttonClasses } from "@/components/Button";

export default function UploadDropzone(props: {
  busy: boolean;
  error: string | null;
  onFile: (f: File) => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) props.onFile(f);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-black">ZIP 파일 업로드</h2>
      <p className="text-sm text-[var(--color-text-muted)]">
        인스타그램에서 받은 ZIP 파일을 그대로 올려 주세요.
      </p>

      <div
        role="button"
        tabIndex={0}
        aria-label="ZIP 파일 선택"
        onClick={() => !props.busy && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !props.busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-[var(--color-accent)] bg-[var(--color-bg-muted)]" : "border-[var(--color-border)]"
        }`}
      >
        {props.busy ? (
          <p className="text-sm">분석 중이에요… 파일은 기기 밖으로 나가지 않아요.</p>
        ) : (
          <>
            <p className="text-4xl" aria-hidden>📦</p>
            <p className="text-sm font-semibold">여기를 눌러 파일을 선택하거나 끌어다 놓아 주세요</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              압축을 풀지 않은 .zip 파일을 업로드해 주세요.
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) props.onFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {props.error && (
        <div role="alert" className="border border-[var(--color-border-strong)] p-4 text-sm">
          {props.error}
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)]">
        업로드한 ZIP 파일은 이 브라우저 안에서만 분석되고 서버로 전송되지 않아요.
      </p>

      <button type="button" className={buttonClasses("secondary")} onClick={props.onBack} disabled={props.busy}>
        뒤로
      </button>
    </div>
  );
}
