"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { addWords, deleteWord, type FormState } from "./actions";

export default function WordsPanel({
  language, category, categories, words,
}: {
  language: string; category: string; categories: string[];
  words: { id: number; word: string }[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<FormState, FormData>(addWords, {});
  const setFilter = (l: string, c: string) =>
    router.push(`/admin/band-name/words?language=${l}&category=${c}`);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display font-black text-2xl mb-6">단어 관리</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {["korean", "english"].map((l) => (
          <button key={l} onClick={() => setFilter(l, category)}
            className={`px-3 py-1.5 text-sm border ${l === language ? "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]" : "border-[var(--color-border)]"}`}>
            {l === "korean" ? "한국어" : "영어"}
          </button>
        ))}
      </div>
      <select value={category} onChange={(e) => setFilter(language, e.target.value)}
        className="border border-[var(--color-border-strong)] px-3 py-2 mb-6">
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <form action={formAction} className="border border-[var(--color-border)] p-4 mb-6">
        <input type="hidden" name="language" value={language} />
        <input type="hidden" name="category" value={category} />
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          단어 추가 (쉼표로 여러 개)
        </label>
        <textarea name="words" rows={2} className="w-full border border-[var(--color-border-strong)] px-3 py-2 mb-2"
          placeholder="예: 철, 강철, 쇳물" />
        <button className="px-4 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)]">
          추가
        </button>
        {state.error && <p className="text-sm text-red-600 mt-2">{state.error}</p>}
        {state.ok && <p className="text-sm text-green-700 mt-2">{state.ok}</p>}
      </form>

      <ul className="flex flex-wrap gap-2">
        {words.map((w) => (
          <li key={w.id} className="inline-flex items-center gap-2 border border-[var(--color-border)] pl-3 pr-1 py-1">
            <span className="text-sm">{w.word}</span>
            <button aria-label={`${w.word} 삭제`}
              onClick={async () => { if (confirm(`'${w.word}' 삭제?`)) { const r = await deleteWord(w.id); if (r.error) alert(r.error); else router.refresh(); } }}
              className="w-5 h-5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">×</button>
          </li>
        ))}
        {words.length === 0 && <li className="text-sm text-[var(--color-text-muted)]">단어 없음</li>}
      </ul>
    </div>
  );
}
