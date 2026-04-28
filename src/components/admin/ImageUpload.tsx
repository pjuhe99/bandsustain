"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { uploadImage } from "@/lib/upload";

type Resource = "members" | "songs" | "news" | "quotes";

export default function ImageUpload({
  name,
  resource,
  initialPath,
  required,
  alt,
}: {
  name: string;
  resource: Resource;
  initialPath?: string | null;
  required?: boolean;
  alt: string;
}) {
  const [path, setPath] = useState(initialPath ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setPending(true);
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
