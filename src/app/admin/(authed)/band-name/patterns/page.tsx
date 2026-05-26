import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { ALL_WORD_CATEGORIES } from "@/lib/bandName/types";
import PatternForm from "./PatternForm";
import { deletePattern } from "./actions";

export const dynamic = "force-dynamic";
type Row = { id: number; pattern_key: string; language: string; slots: unknown; scenes: unknown; moods: unknown; weight: number };

export default async function PatternsAdminPage() {
  const [rows] = await getPool().query<(RowDataPacket & Row)[]>(
    "SELECT id, pattern_key, language, slots, scenes, moods, weight FROM bandname_patterns ORDER BY pattern_key");
  const arr = (v: unknown) => (Array.isArray(v) ? v : JSON.parse(String(v))) as string[];
  return (
    <div className="max-w-3xl">
      <h1 className="font-display font-black text-2xl mb-6">패턴 관리</h1>
      <PatternForm categories={ALL_WORD_CATEGORIES} />
      <table className="w-full text-sm mt-8 border-collapse">
        <thead><tr className="text-left border-b border-[var(--color-border-strong)]">
          <th className="py-2">key</th><th>lang</th><th>slots</th><th>scenes</th><th>w</th><th></th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--color-border)]">
              <td className="py-2 font-mono text-xs">{r.pattern_key}</td>
              <td>{r.language}</td>
              <td>{arr(r.slots).join("+")}</td>
              <td className="text-xs">{arr(r.scenes).join(",")}</td>
              <td>{r.weight}</td>
              <td>
                <form action={async () => { "use server"; await deletePattern(r.id); }}>
                  <button className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">삭제</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
