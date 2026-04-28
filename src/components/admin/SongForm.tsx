"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { Song } from "@/lib/songs";
import ImageUpload from "@/components/admin/ImageUpload";
import type { FormState } from "@/app/admin/(authed)/songs/actions";

const CATEGORIES = ["Album", "EP", "Single", "Live Session"] as const;

export default function SongForm({
  song,
  action,
  submitLabel,
}: {
  song?: Song;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  const releasedDefault = song ? song.releasedAt.toISOString().slice(0, 10) : "";
  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {song && (
        <div className="flex justify-end">
          <Link
            href={`/songs#song-${song.id}`}
            target="_blank"
            className="text-xs uppercase tracking-wider underline underline-offset-2"
          >
            공개 페이지에서 보기 ↗
          </Link>
        </div>
      )}
      <Field name="title" label="Title" defaultValue={song?.title} error={fe.title} required />
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Category</span>
        <select
          name="category"
          defaultValue={song?.category ?? "Single"}
          required
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {fe.category && <span className="text-xs text-[var(--color-accent)]">{fe.category}</span>}
      </label>
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Artwork</label>
        <ImageUpload
          name="artworkUrl"
          resource="songs"
          initialPath={song?.artworkUrl}
          required
          alt={song?.title ?? "song artwork"}
        />
        {fe.artworkUrl && <p className="text-xs text-[var(--color-accent)] mt-2">{fe.artworkUrl}</p>}
      </div>
      <Field name="listenUrl" label="Listen URL (YouTube/Spotify 등, 선택)" defaultValue={song?.listenUrl ?? ""} error={fe.listenUrl} />
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Lyrics</span>
        <textarea
          name="lyrics"
          rows={20}
          defaultValue={song?.lyrics ?? ""}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] font-mono text-sm leading-relaxed"
        />
        {fe.lyrics && <span className="text-xs text-[var(--color-accent)]">{fe.lyrics}</span>}
      </label>
      <Field name="releasedAt" label="Released Date" defaultValue={releasedDefault} error={fe.releasedAt} required type="date" />
      {state.error && <p className="text-sm text-[var(--color-accent)]">{state.error}</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
        >
          {pending ? "저장 중…" : submitLabel}
        </button>
        <Link
          href="/admin/songs"
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
        >
          취소
        </Link>
      </div>
    </form>
  );
}

function Field({
  name, label, defaultValue, error, required, type,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      <input
        type={type ?? "text"}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
      />
      {error && <span className="text-xs text-[var(--color-accent)]">{error}</span>}
    </label>
  );
}
