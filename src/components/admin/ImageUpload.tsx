"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { uploadImage } from "@/lib/upload";

type Resource = "members" | "songs" | "news" | "quotes" | "yeongmin" | "columns";

export default function ImageUpload({
  name,
  resource,
  initialPath,
  required,
  alt,
  onPendingChange,
}: {
  name: string;
  resource: Resource;
  initialPath?: string | null;
  required?: boolean;
  alt: string;
  /** 업로드 시작·종료를 상위 폼에 알린다. `useUploadPending` 참고. */
  onPendingChange?: (name: string, pending: boolean) => void;
}) {
  const [path, setPath] = useState(initialPath ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 최신 콜백을 ref 로 들고 있어야, 아래 언마운트 정리가 옛 클로저를 부르지 않는다.
  // (콜백을 effect 의존성에 직접 넣으면, 호출부가 매 렌더 새 함수를 넘길 때
  //  정리가 렌더마다 돌아 업로드 도중에 pending 이 풀려버린다.)
  const notifyRef = useRef(onPendingChange);
  useEffect(() => {
    notifyRef.current = onPendingChange;
  });

  // 업로드 도중 언마운트되면 상위 폼이 영원히 "업로드 중" 으로 남는다. 해제 보고.
  useEffect(() => {
    return () => notifyRef.current?.(name, false);
  }, [name]);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setPending(true);
    onPendingChange?.(name, true);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await uploadImage(fd, resource);
      if (res.ok) {
        setPath(res.path);
      } else {
        setError(res.error);
      }
    } finally {
      setPending(false);
      onPendingChange?.(name, false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={path} required={required} />
      {path && (
        <div className="relative w-40 h-40 bg-[var(--color-bg-muted)]">
          <Image src={path} alt={alt} fill className="object-cover" sizes="160px" />
        </div>
      )}
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleChange}
          disabled={pending}
          className="text-sm"
        />
        {pending && <span className="text-xs text-[var(--color-text-muted)]">업로드 중…</span>}
      </div>
      {error && <p className="text-xs text-[var(--color-accent)]">{error}</p>}
    </div>
  );
}
