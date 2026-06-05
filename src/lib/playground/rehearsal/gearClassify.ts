import map from "./data/equipment-classification.json";
import type { RoomEquipmentType, RoomGear } from "./types";

const TABLE = map as Record<string, RoomEquipmentType>;

// 일반 단어 키워드 폴백 (admin 수기 입력용 — 정확매핑 우선, '기타' 단독은 모호해 제외)
const KEYWORD_RULES: [RegExp, RoomEquipmentType][] = [
  [/드럼|drum/i, "DRUM"],
  [/기타\s*앰프|guitar\s*amp/i, "GUITAR_AMP"],
  [/베이스|bass/i, "BASS_AMP"],
  [/키보드|신디|신스|피아노|keyboard|synth|piano/i, "KEYBOARD"],
];

export function classifyGear(name: string): RoomEquipmentType {
  const exact = TABLE[name.trim()];
  if (exact) return exact;
  for (const [re, type] of KEYWORD_RULES) if (re.test(name)) return type;
  return "ETC";
}

export function classifyGearList(raw: string): RoomGear[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => ({ name, type: classifyGear(name) }));
}
