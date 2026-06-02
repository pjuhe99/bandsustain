import type { GeoPoint } from "./types";
import { COORD_ROUNDING_DECIMALS } from "./config";

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function centroid(points: GeoPoint[]): GeoPoint {
  if (points.length === 0) throw new Error("centroid: empty points");
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

export function roundCoord(value: number, decimals = COORD_ROUNDING_DECIMALS): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
