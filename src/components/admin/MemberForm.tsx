"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { Member } from "@/lib/members";
import ImageUpload from "@/components/admin/ImageUpload";
import type { FormState } from "@/app/admin/(authed)/members/actions";

export default function MemberForm({
  member,
  action,
  submitLabel,
}: {
  member?: Member;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {member && (
        <div className="flex justify-end">
          <Link
            href={`/members#member-${member.id}`}
            target="_blank"
            className="text-xs uppercase tracking-wider underline underline-offset-2"
          >
            공개 페이지에서 보기 ↗
          </Link>
        </div>
      )}
      <Field name="nameEn" label="Name (EN)" defaultValue={member?.nameEn} error={fe.nameEn} required />
      <Field name="nameKr" label="이름" defaultValue={member?.nameKr} error={fe.nameKr} required />
      <Field name="position" label="Position" defaultValue={member?.position} error={fe.position} required />
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">사진</label>
        <ImageUpload
          name="photoUrl"
          resource="members"
          initialPath={member?.photoUrl}
          required
          alt={member?.nameKr ?? "member photo"}
        />
        {fe.photoUrl && <p className="text-xs text-[var(--color-accent)] mt-2">{fe.photoUrl}</p>}
      </div>
      <Field name="favoriteArtist" label="Favorite Artist" defaultValue={member?.favoriteArtist ?? ""} error={fe.favoriteArtist} />
      <Field name="favoriteSong" label="Favorite Song" defaultValue={member?.favoriteSong ?? ""} error={fe.favoriteSong} />
      <Field name="displayOrder" label="순서 (숫자, 낮을수록 위)" defaultValue={String(member?.displayOrder ?? 0)} error={fe.displayOrder} required type="number" />
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
          href="/admin/members"
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
