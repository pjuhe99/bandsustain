import stationsData from "./data/metro-stations.json";
import { LINE_ORDER } from "./metroLineColors";

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

export function searchStations(query: string, selectedLines: string[]): MetroStation[] {
  const q = normalize(query);
  if (!q) return []; // 빈 쿼리: 호선 선택과 무관하게 나열하지 않음 (search-first)
  const lineSet = new Set(selectedLines);
  const matches: { s: MetroStation; prefix: boolean }[] = [];
  for (const s of METRO_STATIONS) {
    if (lineSet.size > 0 && !s.lines.some((l) => lineSet.has(l))) continue;
    const n = normalize(s.name);
    if (n.startsWith(q)) matches.push({ s, prefix: true });
    else if (n.includes(q)) matches.push({ s, prefix: false });
  }
  matches.sort((a, b) =>
    a.prefix === b.prefix ? a.s.name.localeCompare(b.s.name, "ko") : a.prefix ? -1 : 1,
  );
  return matches.slice(0, 50).map((m) => m.s);
}

// 선택 후 입력 텍스트가 라벨과 달라지면 선택 무효화 — 표시/선택값 불일치 차단.
export function reconcileSelection(selectedStationId: string | null, newQuery: string): string | null {
  if (!selectedStationId) return null;
  const s = byId.get(selectedStationId);
  if (!s) return null;
  return stationLabel(s) === newQuery ? selectedStationId : null;
}
