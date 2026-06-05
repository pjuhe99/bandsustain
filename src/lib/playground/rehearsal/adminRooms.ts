import { classifyGearList } from "./gearClassify";
import type { RoomGear } from "./types";

export type RoomRowInput = { name: string; price: string; capacity: string; gear: string; review: string };
export type RoomWrite = {
  name: string; hourlyPrice: number | null; capacity: number | null;
  equipment: RoomGear[]; review: string | null; sortOrder: number;
};

function intOrNull(s: string): number | null {
  const t = s.trim().replace(/[^0-9]/g, "");
  return t ? parseInt(t, 10) : null;
}

export function parseRoomRows(rows: RoomRowInput[]): RoomWrite[] {
  const out: RoomWrite[] = [];
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) continue;
    out.push({
      name,
      hourlyPrice: intOrNull(r.price),
      capacity: intOrNull(r.capacity),
      equipment: classifyGearList(r.gear),
      review: r.review.trim() || null,
      sortOrder: out.length,
    });
  }
  return out;
}

export function deriveStudioStats(rooms: { hourlyPrice: number | null; capacity: number | null }[]):
  { priceMin: number | null; priceMax: number | null; capacityMax: number | null } {
  const prices = rooms.map((r) => r.hourlyPrice).filter((p): p is number => p != null);
  const caps = rooms.map((r) => r.capacity).filter((c): c is number => c != null);
  return {
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    capacityMax: caps.length ? Math.max(...caps) : null,
  };
}

export function gearToText(equipment: { name: string }[]): string {
  return equipment.map((g) => g.name).join(", ");
}
