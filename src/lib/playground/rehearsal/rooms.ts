import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import type { StudioRoom, RoomGear } from "./types";

function parseEquipment(v: unknown): RoomGear[] {
  if (v == null) return [];
  if (typeof v === "string") { try { return JSON.parse(v) as RoomGear[]; } catch { return []; } }
  return v as RoomGear[];
}

export async function loadRoomsByStudioIds(ids: number[]): Promise<Map<number, StudioRoom[]>> {
  const map = new Map<number, StudioRoom[]>();
  if (ids.length === 0) return map;
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, studio_id, name, hourly_price, capacity, equipment_json, review
       FROM playground_studio_rooms
      WHERE studio_id IN (${ids.map(() => "?").join(",")})
      ORDER BY studio_id, sort_order, id`,
    ids,
  );
  for (const r of rows) {
    const room: StudioRoom = {
      id: r.id, name: r.name,
      hourlyPrice: r.hourly_price != null ? Number(r.hourly_price) : null,
      capacity: r.capacity != null ? Number(r.capacity) : null,
      equipment: parseEquipment(r.equipment_json),
      review: r.review,
    };
    const list = map.get(r.studio_id) ?? [];
    list.push(room);
    map.set(r.studio_id, list);
  }
  return map;
}
