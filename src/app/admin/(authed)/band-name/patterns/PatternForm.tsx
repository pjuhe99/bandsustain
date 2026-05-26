"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { savePattern, type FormState } from "./actions";

const SCENES = ["jrock", "hongdae", "punk", "citypop", "emo", "campus", "metal"];
const MOODS = ["fresh", "dreamy", "wistful", "funny", "rough", "romantic"];

export default function PatternForm({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [state, action] = useActionState<FormState, FormData>(
    async (p, fd) => { const r = await savePattern(p, fd); if (!r.error) router.refresh(); return r; }, {});
  const checks = (name: string, opts: string[]) => (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
      {opts.map((o) => (
        <label key={o} className="text-xs inline-flex items-center gap-1">
          <input type="checkbox" name={name} value={o} /> {o}
        </label>
      ))}
    </div>
  );
  return (
    <form action={action} className="border border-[var(--color-border)] p-4 grid gap-2">
      <input name="patternKey" placeholder="pattern_key (예: ko_doom_ritual)" required
        className="border border-[var(--color-border-strong)] px-3 py-2" />
      <select name="language" className="border border-[var(--color-border-strong)] px-3 py-2">
        <option value="korean">korean</option><option value="english">english</option>
      </select>
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">slots</p>{checks("slots", categories)}
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">scenes</p>{checks("scenes", SCENES)}
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">moods</p>{checks("moods", MOODS)}
      <div className="flex gap-2">
        <input name="separator" placeholder="separator(빈칸=한국어, 공백=영어)" className="border border-[var(--color-border-strong)] px-3 py-2 flex-1" />
        <input name="minWeirdness" type="number" min={1} max={5} defaultValue={1} className="border border-[var(--color-border-strong)] px-3 py-2 w-20" />
        <input name="maxWeirdness" type="number" min={1} max={5} defaultValue={5} className="border border-[var(--color-border-strong)] px-3 py-2 w-20" />
        <input name="weight" type="number" min={1} defaultValue={10} className="border border-[var(--color-border-strong)] px-3 py-2 w-24" />
      </div>
      <button className="px-4 py-2 text-sm font-semibold uppercase tracking-wider bg-[var(--color-text)] text-[var(--color-bg)] border border-[var(--color-text)] justify-self-start">
        저장(추가/수정)
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
