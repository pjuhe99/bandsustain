"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { Quote } from "@/lib/quotes";
import ImageUpload from "@/components/admin/ImageUpload";
import type { FormState } from "@/app/admin/(authed)/quotes/actions";

export default function QuoteForm({
  quote,
  action,
  submitLabel,
}: {
  quote?: Quote;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {quote && (
        <div className="flex justify-end">
          <Link
            href={`/quote#quote-${quote.id}`}
            target="_blank"
            className="text-xs uppercase tracking-wider underline underline-offset-2"
          >
            공개 페이지에서 보기 ↗
          </Link>
        </div>
      )}
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Text</span>
        <textarea
          name="text"
          rows={8}
          defaultValue={quote?.text ?? ""}
          required
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] leading-relaxed"
        />
        {fe.text && <span className="text-xs text-[var(--color-accent)]">{fe.text}</span>}
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Language</span>
        <select
          name="lang"
          defaultValue={quote?.lang ?? "ko"}
          required
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        >
          <option value="ko">ko</option>
          <option value="en">en</option>
        </select>
        {fe.lang && <span className="text-xs text-[var(--color-accent)]">{fe.lang}</span>}
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Translation (선택)</span>
        <textarea
          name="textTranslated"
          rows={4}
          defaultValue={quote?.text_translated ?? ""}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] leading-relaxed"
        />
        {fe.textTranslated && <span className="text-xs text-[var(--color-accent)]">{fe.textTranslated}</span>}
      </label>
      <Field name="attribution" label="Attribution (인물, 선택)" defaultValue={quote?.attribution ?? ""} error={fe.attribution} />
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Portrait (선택)</label>
        <ImageUpload
          name="portraitUrl"
          resource="quotes"
          initialPath={quote?.portrait_url}
          alt={quote?.attribution ?? "quote portrait"}
        />
        {fe.portraitUrl && <p className="text-xs text-[var(--color-accent)] mt-2">{fe.portraitUrl}</p>}
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
          href="/admin/quotes"
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
