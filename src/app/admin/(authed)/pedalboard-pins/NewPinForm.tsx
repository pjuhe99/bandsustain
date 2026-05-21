"use client";
import { useActionState, useState, useTransition } from "react";
import type { Member } from "@/lib/members";
import type { FormState } from "./actions";
import { createPinAction, lookupLayoutAction } from "./actions";

type LayoutPreview = {
  id: number;
  title: string;
  share_token: string;
  visibility: "private" | "unlisted" | "public";
  board_name: string;
  board_brand: string;
  updated_at: string;
};

export function NewPinForm({
  members,
  createAction,
  lookupAction,
}: {
  members: Member[];
  createAction: typeof createPinAction;
  lookupAction: typeof lookupLayoutAction;
}) {
  const initial: FormState = {};
  const [state, formAction] = useActionState(createAction, initial);
  const [layoutIdRaw, setLayoutIdRaw] = useState("");
  const [preview, setPreview] = useState<LayoutPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLookup() {
    setPreview(null);
    setPreviewError(null);
    const id = Number(layoutIdRaw);
    if (!Number.isFinite(id) || id <= 0) {
      setPreviewError("올바른 layout id를 입력해주세요");
      return;
    }
    startTransition(async () => {
      const res = await lookupAction(id);
      if (!res.ok) {
        setPreviewError(res.error);
        return;
      }
      setPreview({
        id: res.layout.id,
        title: res.layout.title,
        share_token: res.layout.share_token,
        visibility: res.layout.visibility,
        board_name: res.layout.board_name,
        board_brand: res.layout.board_brand,
        updated_at: res.layout.updated_at.toString(),
      });
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium mb-1">멤버</span>
          <select name="member_id" required defaultValue="" className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2">
            <option value="" disabled>멤버 선택…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.nameKr} · {m.position}{!m.published && " (비공개)"}</option>
            ))}
          </select>
          {state.fieldErrors?.member_id && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.member_id}</p>}
        </label>

        <label className="block">
          <span className="block text-sm font-medium mb-1">Layout ID</span>
          <div className="flex gap-2">
            <input
              type="number"
              name="layout_id"
              required
              min={1}
              value={layoutIdRaw}
              onChange={(e) => { setLayoutIdRaw(e.target.value); setPreview(null); setPreviewError(null); }}
              className="flex-1 border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2"
            />
            <button type="button" onClick={handleLookup} disabled={isPending} className="px-4 py-2 text-sm font-semibold uppercase tracking-wider border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)] disabled:opacity-50">
              {isPending ? "..." : "확인"}
            </button>
          </div>
          {previewError && <p className="mt-1 text-sm text-red-700">{previewError}</p>}
          {preview && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              ✓ Layout #{preview.id} · &quot;{preview.title}&quot; · {preview.board_brand} {preview.board_name} · {preview.visibility}
            </p>
          )}
          {state.fieldErrors?.layout_id && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.layout_id}</p>}
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Override 타이틀 <span className="text-[var(--color-text-muted)]">(비우면 원본 layout title 사용, 200자 이내)</span></span>
        <input type="text" name="override_title" maxLength={200} className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2" />
        {state.fieldErrors?.override_title && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.override_title}</p>}
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">캡션 <span className="text-[var(--color-text-muted)]">(200자 이내, 한 줄 정도)</span></span>
        <input type="text" name="caption" maxLength={200} className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2" />
        {state.fieldErrors?.caption && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.caption}</p>}
      </label>

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <button type="submit" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors">
        + 추가
      </button>
    </form>
  );
}
