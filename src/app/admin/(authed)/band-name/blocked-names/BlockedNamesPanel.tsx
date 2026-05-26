"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { addBlockedName, deleteBlockedName, type FormState } from "./actions";

export default function BlockedNamesPanel({ names }: { names: { id: number; name: string }[] }) {
  const router = useRouter();
  const [state, action] = useActionState<FormState, FormData>(addBlockedName, {});
  return (
    <div className="max-w-2xl">
      <h1 className="font-display font-black text-2xl mb-6">차단 밴드명</h1>
      <form action={action} className="flex gap-2 border border-[var(--color-border)] p-4 mb-6">
        <input name="name" placeholder="예: METALLICA / 부활" className="border border-[var(--color-border-strong)] px-3 py-2 flex-1" />
        <button className="px-4 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)]">추가</button>
        {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="w-full text-sm text-green-700">{state.ok}</p>}
      </form>
      <ul className="flex flex-wrap gap-2">
        {names.map((n) => (
          <li key={n.id} className="inline-flex items-center gap-2 border border-[var(--color-border)] pl-3 pr-1 py-1">
            <span className="text-sm">{n.name}</span>
            <button onClick={async () => { await deleteBlockedName(n.id); router.refresh(); }}
              className="w-5 h-5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">×</button>
          </li>
        ))}
        {names.length === 0 && <li className="text-sm text-[var(--color-text-muted)]">없음</li>}
      </ul>
    </div>
  );
}
