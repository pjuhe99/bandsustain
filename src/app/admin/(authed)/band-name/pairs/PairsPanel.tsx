"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { addPair, deletePair, type FormState } from "./actions";

export default function PairsPanel({
  kind, pairs,
}: { kind: string; pairs: { id: number; a: string; b: string }[] }) {
  const router = useRouter();
  const [state, action] = useActionState<FormState, FormData>(addPair, {});
  return (
    <div className="max-w-2xl">
      <h1 className="font-display font-black text-2xl mb-6">단어쌍 관리</h1>
      <div className="flex gap-2 mb-4">
        {["preferred", "blocked"].map((k) => (
          <button key={k} onClick={() => router.push(`/admin/band-name/pairs?kind=${k}`)}
            className={`px-3 py-1.5 text-sm border ${k === kind ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]" : "border-[var(--color-border)]"}`}>
            {k === "preferred" ? "선호(가점)" : "차단(감점)"}
          </button>
        ))}
      </div>
      <form action={action} className="flex flex-wrap gap-2 border border-[var(--color-border)] p-4 mb-6">
        <input type="hidden" name="kind" value={kind} />
        <input name="wordA" placeholder="단어 A" className="border border-[var(--color-border-strong)] px-3 py-2" />
        <input name="wordB" placeholder="단어 B" className="border border-[var(--color-border-strong)] px-3 py-2" />
        <button className="px-4 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)]">추가</button>
        {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="w-full text-sm text-green-700">{state.ok}</p>}
      </form>
      <ul className="flex flex-col gap-1">
        {pairs.map((p) => (
          <li key={p.id} className="flex items-center justify-between border-b border-[var(--color-border)] py-1.5 text-sm">
            <span>{p.a} + {p.b}</span>
            <button onClick={async () => { await deletePair(p.id); router.refresh(); }}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">삭제</button>
          </li>
        ))}
        {pairs.length === 0 && <li className="text-sm text-[var(--color-text-muted)]">없음</li>}
      </ul>
    </div>
  );
}
