"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { LiveEvent } from "@/lib/live";
import type { FormState } from "@/app/admin/(authed)/live/actions";

export default function LiveForm({
  item,
  action,
  submitLabel,
}: {
  item?: LiveEvent;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {item && (
        <div className="flex justify-end">
          <Link
            href="/live"
            target="_blank"
            className="text-xs uppercase tracking-wider underline underline-offset-2"
          >
            공개 페이지에서 보기 ↗
          </Link>
        </div>
      )}
      <Field
        name="eventDate"
        label="공연 일자"
        type="date"
        defaultValue={item?.eventDate ?? ""}
        error={fe.eventDate}
        required
      />
      <Field
        name="venue"
        label="공연장"
        defaultValue={item?.venue}
        error={fe.venue}
        required
      />
      <Field
        name="city"
        label="도시"
        defaultValue={item?.city}
        error={fe.city}
        required
      />
      <Field
        name="ticketUrl"
        label="티켓 URL (선택)"
        type="url"
        defaultValue={item?.ticketUrl ?? ""}
        error={fe.ticketUrl}
        placeholder="https://..."
      />
      <Field
        name="videoUrl"
        label="영상 URL (선택, 유튜브/인스타/페북 등)"
        type="url"
        defaultValue={item?.videoUrl ?? ""}
        error={fe.videoUrl}
        placeholder="https://..."
      />
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="published"
          defaultChecked={item ? item.published : true}
          className="h-4 w-4"
        />
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          공개
        </span>
      </label>
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
          href="/admin/live"
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
        >
          취소
        </Link>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  error,
  required,
  type,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      <input
        type={type ?? "text"}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
      />
      {error && <span className="text-xs text-[var(--color-accent)]">{error}</span>}
    </label>
  );
}
