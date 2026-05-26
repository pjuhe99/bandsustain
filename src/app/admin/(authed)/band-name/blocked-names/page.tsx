import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import BlockedNamesPanel from "./BlockedNamesPanel";

export const dynamic = "force-dynamic";
type Row = { id: number; name: string };

export default async function BlockedNamesAdminPage() {
  const [rows] = await getPool().query<(RowDataPacket & Row)[]>(
    "SELECT id, name FROM bandname_blocked_names ORDER BY name");
  return <BlockedNamesPanel names={rows.map((r) => ({ id: r.id, name: r.name }))} />;
}
