"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/admin/(authed)/columns/actions";
import type { ColumnTopic } from "@/lib/columns";

export type TopicMemberOption = { id: number; label: string };

export default function TopicForm({
  topic,
  members,
  action,
  submitLabel,
}: {
  topic?: ColumnTopic;
  members: TopicMemberOption[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-xl">
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">제목 (예: 김영민의 휴먼 역사갤러리)</span>
        <input
          name="title"
          defaultValue={topic?.title ?? ""}
          required
          maxLength={120}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        />
        {fe.title && <span className="text-xs text-[var(--color-accent)]">{fe.title}</span>}
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">연결 멤버 (선택)</span>
        <select
          name="memberId"
          defaultValue={topic?.memberId != null ? String(topic.memberId) : ""}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        >
          <option value="">— 연결 안 함 —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">소개 (선택)</span>
        <input
          name="description"
          defaultValue={topic?.description ?? ""}
          maxLength={500}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">정렬 순서 (낮을수록 앞)</span>
        <input
          name="sortOrder"
          type="number"
          defaultValue={topic?.sortOrder ?? 0}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)] w-32"
        />
      </label>

      {state.error && <p className="text-sm text-[var(--color-accent)]">{state.error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
        >
          {pending ? "저장 중…" : submitLabel}
        </button>
        <Link
          href="/admin/columns/topics"
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
