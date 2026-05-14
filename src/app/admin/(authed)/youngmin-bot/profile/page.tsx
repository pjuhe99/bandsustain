"use client";

import { useEffect, useRef, useState } from "react";

export default function ProfilePage() {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    fetch("/api/admin/youngmin-bot/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCurrentPath(d.profileImagePath ?? null))
      .catch(() => setErr("로드 실패"));
  }

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErr("파일 선택");
      return;
    }
    setUploading(true);
    setErr("");
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/youngmin-bot/profile", {
        method: "POST",
        body: fd,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.error ?? "업로드 실패");
      } else {
        setMsg("업로드 완료");
        if (fileRef.current) fileRef.current.value = "";
        refresh();
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)]">
          현재 프로필 사진
        </h2>
        {currentPath ? (
          <div className="w-32 h-32 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
            <img src={currentPath} alt="김영민 봇 프로필" className="w-32 h-32 object-cover" />
          </div>
        ) : (
          <p className="text-[var(--color-text-muted)] text-sm">아직 설정 안 됨.</p>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)]">
          새 사진 업로드
        </h2>
        <input ref={fileRef} type="file" accept="image/*" className="text-sm" />
        <button
          onClick={upload}
          disabled={uploading}
          className="self-start px-5 py-2.5 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] disabled:opacity-50"
        >
          {uploading ? "업로드 중..." : "업로드"}
        </button>
        <div className="flex gap-3 text-sm">
          {msg && <span className="text-[var(--color-text-muted)]">{msg}</span>}
          {err && <span className="text-red-600">{err}</span>}
        </div>
      </section>
    </div>
  );
}
