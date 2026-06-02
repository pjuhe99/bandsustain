import stationsData from "./data/metro-stations.json";

export type MetroStation = { name: string; lat: number; lng: number };

export const METRO_STATIONS: MetroStation[] = stationsData as MetroStation[];

const byName = new Map<string, MetroStation>(
  METRO_STATIONS.map((s) => [s.name, s]),
);

export function getStationNames(): string[] {
  return METRO_STATIONS.map((s) => s.name);
}

export function findStationByName(name: string): MetroStation | null {
  return byName.get(name.trim()) ?? null;
}
