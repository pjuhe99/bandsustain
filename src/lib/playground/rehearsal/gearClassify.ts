import map from "./data/equipment-classification.json";
import type { RoomEquipmentType, RoomGear } from "./types";

const TABLE = map as Record<string, RoomEquipmentType>;

export function classifyGear(name: string): RoomEquipmentType {
  return TABLE[name.trim()] ?? "ETC";
}

export function classifyGearList(raw: string): RoomGear[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => ({ name, type: classifyGear(name) }));
}
