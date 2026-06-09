import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import type { GeoPoint, RouteResult, TransportMode, TimeBucket } from "./types";
import { roundCoord } from "./geo";
import { ROUTE_CACHE_TTL_HOURS } from "./config";

export function makeOriginKey(origin: GeoPoint): string {
  return `${roundCoord(origin.lat)},${roundCoord(origin.lng)}`;
}

export async function readRouteCache(args: {
  origin: GeoPoint; destinationId: number; mode: TransportMode; timeBucket: TimeBucket;
}): Promise<RouteResult | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT travel_minutes, transfer_count, walking_minutes, fare, distance_meters, provider
       FROM playground_route_cache
      WHERE origin_key=? AND destination_id=? AND transport_mode=? AND time_bucket=? AND expires_at > NOW()
      LIMIT 1`,
    [makeOriginKey(args.origin), args.destinationId, args.mode, args.timeBucket],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    travelMinutes: r.travel_minutes, transferCount: r.transfer_count, walkingMinutes: r.walking_minutes,
    fare: r.fare, distanceMeters: r.distance_meters, provider: r.provider,
  };
}

export async function writeRouteCache(args: {
  origin: GeoPoint; destinationId: number; mode: TransportMode; timeBucket: TimeBucket; route: RouteResult;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO playground_route_cache
       (origin_key, origin_lat, origin_lng, destination_id, transport_mode, time_bucket,
        travel_minutes, transfer_count, walking_minutes, fare, distance_meters, provider, raw_response_json, expires_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, DATE_ADD(NOW(), INTERVAL ? HOUR))
     ON DUPLICATE KEY UPDATE
       travel_minutes=VALUES(travel_minutes), transfer_count=VALUES(transfer_count),
       walking_minutes=VALUES(walking_minutes), fare=VALUES(fare), distance_meters=VALUES(distance_meters),
       provider=VALUES(provider), raw_response_json=VALUES(raw_response_json), expires_at=VALUES(expires_at)`,
    [makeOriginKey(args.origin), roundCoord(args.origin.lat), roundCoord(args.origin.lng), args.destinationId,
     args.mode, args.timeBucket, args.route.travelMinutes, args.route.transferCount, args.route.walkingMinutes,
     args.route.fare, args.route.distanceMeters, args.route.provider, JSON.stringify(args.route), ROUTE_CACHE_TTL_HOURS],
  );
}
