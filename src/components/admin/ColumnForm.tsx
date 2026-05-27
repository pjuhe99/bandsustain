"use client";
import { useActionState } from "react";
import Link from "next/link";
import ImageUpload from "@/components/admin/ImageUpload";
import ColumnBodyEditor from "@/components/admin/ColumnBodyEditor";
import type { FormState } from "@/app/admin/(authed)/columns/actions";
import type { ColumnPost, ColumnTopic } from "@/lib/columns";

export default function ColumnForm({
  post,
  topics,
  action,
  submitLabel,
}: {
  post?: ColumnPost;
  topics: ColumnTopic[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  if (topics.length === 0) {
    return (
      <p className="text-sm">
        먼저 <Link href="/admin/columns/topics" className="underline underline-offset-4">주제</Link>를 하나 이상 만들어 주세요.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {post && (
        <div className="flex justify-end">
          <Link
            href={`/columns/${post.id}`}
            target="_blank"
            className="text-xs uppercase tracking-wider underline underline-offset-2"
          >
            공개 페이지에서 보기 ↗
          </Link>
        </div>
      )}

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">주제</span>
        <select
          name="topicId"
          defaultValue={post ? String(post.topicId) : ""}
          required
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        >
          <option value="" disabled>주제 선택</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}{t.visible ? "" : " (숨김)"}
            </option>
          ))}
        </select>
        {fe.topicId && <span className="text-xs text-[var(--color-accent)]">{fe.topicId}</span>}
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">제목</span>
        <input
          name="title"
          defaultValue={post?.title ?? ""}
          required
          maxLength={200}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        />
        {fe.title && <span className="text-xs text-[var(--color-accent)]">{fe.title}</span>}
      </label>

      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Hero Image (선택)
        </label>
        <ImageUpload
          name="heroImage"
          resource="columns"
          initialPath={post?.heroImage}
          alt={post?.title ?? "column hero"}
        />
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">발췌 (선택, 비우면 본문에서 자동)</span>
        <input
          name="excerpt"
          defaultValue={post?.excerpt ?? ""}
          maxLength={500}
          className="border border-[var(--color-border-strong)] px-3 py-2 bg-[var(--color-bg)]"
        />
      </label>

      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">본문 (마크다운)</label>
        <ColumnBodyEditor name="body" initialValue={post?.body} />
        {fe.body && <p className="text-xs text-[var(--color-accent)] mt-2">{fe.body}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={post?.published ?? false} />
        <span>공개</span>
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
          href="/admin/columns"
          className="px-6 py-3 text-sm font-semibold uppercase tracking-wider bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)] transition-colors"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
