import type { GeoPoint, RouteResult, TransportMode, RouteProviderName } from "./types";
import { haversineMeters } from "./geo";

export interface RouteProvider {
  readonly name: RouteProviderName;
  getRoute(origin: GeoPoint, destination: GeoPoint, mode: TransportMode): Promise<RouteResult>;
}

// 인터페이스 placeholder — 이번 슬라이스 미구현
export interface Geocoder {
  geocode(query: string): Promise<GeoPoint | null>;
}

const TRANSIT_KMH = 22; // 버스/지하철 대기 포함 실효 속도
const CAR_KMH = 30;     // 도심 주행

export class MockRouteProvider implements RouteProvider {
  readonly name: RouteProviderName = "mock";

  async getRoute(origin: GeoPoint, destination: GeoPoint, mode: TransportMode): Promise<RouteResult> {
    const distanceMeters = haversineMeters(origin, destination);
    const km = distanceMeters / 1000;
    const isCar = mode === "car";
    const kmh = isCar ? CAR_KMH : TRANSIT_KMH;
    const travelMinutes = Math.max(1, Math.round((km / kmh) * 60));
    const transferCount = isCar ? 0 : Math.min(3, Math.floor(km / 6)); // ~6km당 환승 1
    const walkingMinutes = isCar ? 0 : Math.min(20, Math.round(km * 1.5));
    const fare = isCar ? null : 1400 + Math.max(0, Math.floor((km - 10) / 5)) * 100;
    return {
      travelMinutes, transferCount, walkingMinutes, fare,
      distanceMeters: Math.round(distanceMeters), provider: this.name,
    };
  }
}

// 실 제공자 골격 — env/creds 자리만, 미구현
export class TransitRouteProvider implements RouteProvider {
  readonly name: RouteProviderName = "odsay";
  constructor(private readonly apiKey: string) {}
  async getRoute(): Promise<RouteResult> {
    // TODO: ODsay/TMAP 대중교통 경로 API 연동
    throw new Error("TransitRouteProvider not implemented");
  }
}

export class CarRouteProvider implements RouteProvider {
  readonly name: RouteProviderName = "tmap";
  constructor(private readonly apiKey: string) {}
  async getRoute(): Promise<RouteResult> {
    // TODO: TMAP/Kakao 자동차 경로 API 연동
    throw new Error("CarRouteProvider not implemented");
  }
}
