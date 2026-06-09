import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export type Region = {
  id: number;
  province: string;
  city: string | null;
  district: string | null;
  displayName: string;
  isSupported: boolean;
  sortOrder: number;
};

export async function listRegions(opts?: { onlySupported?: boolean }): Promise<Region[]> {
  const where = opts?.onlySupported ? "WHERE is_supported = 1" : "";
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, province, city, district, display_name, is_supported, sort_order
       FROM playground_regions ${where}
      ORDER BY sort_order, id`,
  );
  return rows.map((r) => ({
    id: r.id, province: r.province, city: r.city, district: r.district,
    displayName: r.display_name, isSupported: r.is_supported === 1, sortOrder: r.sort_order,
  }));
}
