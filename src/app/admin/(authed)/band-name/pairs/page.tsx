import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import PairsPanel from "./PairsPanel";

export const dynamic = "force-dynamic";
type Row = { id: number; kind: string; word_a: string; word_b: string };

export default async function PairsAdminPage({
  searchParams,
}: { searchParams: Promise<{ kind?: string }> }) {
  const kind = (await searchParams).kind === "blocked" ? "blocked" : "preferred";
  const [rows] = await getPool().query<(RowDataPacket & Row)[]>(
    "SELECT id, kind, word_a, word_b FROM bandname_pairs WHERE kind=? ORDER BY word_a, word_b", [kind]);
  return <PairsPanel kind={kind} pairs={rows.map((r) => ({ id: r.id, a: r.word_a, b: r.word_b }))} />;
}
