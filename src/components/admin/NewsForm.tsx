"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { NewsItem } from "@/lib/news";
import ImageUpload from "@/components/admin/ImageUpload";
import type { FormState } from "@/app/admin/(authed)/news/actions";

export default function NewsForm({
  item,
  action,
  submitLabel,
}: {
  item?: NewsItem;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  const dateDefault = item ? item.date.toISOString().slice(0, 10) : "";
  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {item && (
        <div className="flex justify-end">
          <Link
            href={`/news/${item.id}`}
            target="_blank"
            className="text-xs uppercase tracking-wider underline underline-offset-2"
          >
            공개 페이지에서 보기 ↗
          </Link>
        </div>
      )}
      <Field name="headline" label="Headline" defaultValue={item?.headline} error={fe.headline} required />
      <Field name="category" label="Category (예: Lifestyle, News)" defaultValue={item?.category} error={fe.category} required />
      <Field name="date" label="Date" type="date" defaultValue={dateDefault} error={fe.date} required />
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Hero Image</label>
        <ImageUpload
          name="heroImage"
          resource="news"
          initialPath={item?.heroImage}
          required
          alt={item?.headline ?? "news hero"}
        />
        {fe.heroImage && <p className="text-xs text-[var(--color-accent)] mt-2">{fe.heroImage}</p>}
      </div>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Body</span>
        <textarea
          name="body"
          rows={25}
          defaultValue={item?.body ?? ""}
          required
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] text-sm leading-relaxed"
        />
        {fe.body && <span className="text-xs text-[var(--color-accent)]">{fe.body}</span>}
      </label>
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Mid Image (선택)</label>
        <ImageUpload
          name="midImage"
          resource="news"
          initialPath={item?.midImage}
          alt={(item?.headline ?? "news") + " mid"}
        />
        {fe.midImage && <p className="text-xs text-[var(--color-accent)] mt-2">{fe.midImage}</p>}
      </div>
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
          href="/admin/news"
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
