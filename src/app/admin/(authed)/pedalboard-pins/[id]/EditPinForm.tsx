"use client";
import { useActionState } from "react";
import type { Member } from "@/lib/members";
import type { AdminPinRow } from "@/lib/playground/memberPins";
import type { FormState } from "../actions";
import { updatePinAction } from "../actions";

export function EditPinForm({
  pin,
  members,
  updateAction,
}: {
  pin: AdminPinRow;
  members: Member[];
  updateAction: typeof updatePinAction;
}) {
  const initial: FormState = {};
  const bound = updateAction.bind(null, pin.pin_id);
  const [state, formAction] = useActionState(bound, initial);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium mb-1">멤버</span>
        <select name="member_id" required defaultValue={String(pin.member_id)} className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2">
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.nameKr} · {m.position}{!m.published && " (비공개)"}</option>
          ))}
        </select>
        {state.fieldErrors?.member_id && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.member_id}</p>}
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Override 타이틀 <span className="text-[var(--color-text-muted)]">(비우면 원본 layout title 사용, 200자 이내)</span></span>
        <input type="text" name="override_title" maxLength={200} defaultValue={pin.override_title ?? ""} className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2" />
        {state.fieldErrors?.override_title && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.override_title}</p>}
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">캡션 <span className="text-[var(--color-text-muted)]">(200자 이내)</span></span>
        <input type="text" name="caption" maxLength={200} defaultValue={pin.caption ?? ""} className="w-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2" />
        {state.fieldErrors?.caption && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.caption}</p>}
      </label>

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <button type="submit" className="px-5 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)] transition-colors">
        저장
      </button>
    </form>
  );
}
