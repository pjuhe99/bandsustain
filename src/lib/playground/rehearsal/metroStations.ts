import stationsData from "./data/metro-stations.json";
import { LINE_ORDER } from "./metroLineColors";
import { isChosungQuery, toChosung } from "./chosung";

export type MetroStation = {
  id: string; name: string; lines: string[]; lat: number; lng: number; area: string; ambiguous: boolean;
};

export const METRO_STATIONS: MetroStation[] = stationsData as MetroStation[];

const byId = new Map<string, MetroStation>(METRO_STATIONS.map((s) => [s.id, s]));

export function getStations(): MetroStation[] {
  return METRO_STATIONS;
}

export function findStationById(id: string): MetroStation | null {
  return byId.get(id) ?? null;
}

export function stationLabel(s: MetroStation): string {
  return s.ambiguous ? `${s.name} (${s.area})` : s.name;
}

function lineRank(line: string): number {
  const i = LINE_ORDER.indexOf(line);
  return i === -1 ? 999 : i;
}

export function getLines(): string[] {
  const present = new Set<string>();
  for (const s of METRO_STATIONS) for (const l of s.lines) present.add(l);
  return [...present].sort((a, b) => lineRank(a) - lineRank(b) || a.localeCompare(b, "ko"));
}

const normalize = (s: string) => s.trim().replace(/\s+/g, "").toLowerCase();

export function searchStations(query: string): MetroStation[] {
  const raw = query.trim();
  if (!raw) return [];
  const cho = isChosungQuery(raw);
  const q = cho ? raw.replace(/\s+/g, "") : normalize(query);
  // tier: 0 역명 prefix, 1 역명 substring, 2 초성 prefix (쿼리 형태로 분기 — 상호배타)
  const matches: { s: MetroStation; tier: number }[] = [];
  for (const s of METRO_STATIONS) {
    if (cho) {
      if (toChosung(s.name).startsWith(q)) matches.push({ s, tier: 2 });
    } else {
      const n = normalize(s.name);
      if (n.startsWith(q)) matches.push({ s, tier: 0 });
      else if (n.includes(q)) matches.push({ s, tier: 1 });
    }
  }
  matches.sort((a, b) => a.tier - b.tier || a.s.name.localeCompare(b.s.name, "ko"));
  return matches.slice(0, 50).map((m) => m.s);
}
