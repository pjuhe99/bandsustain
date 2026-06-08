import { z } from "zod";

export const TRANSPORT_MODES = ["transit", "car", "mixed"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const ORIGIN_TYPES = ["station", "address", "district", "manual"] as const;
export type OriginType = (typeof ORIGIN_TYPES)[number];

export const ROUTE_PROVIDERS = ["mock", "kakao", "odsay", "tmap", "manual"] as const;
export type RouteProviderName = (typeof ROUTE_PROVIDERS)[number];

export const TIME_BUCKETS = [
  "weekday_day", "weekday_evening", "weekday_night",
  "weekend_day", "weekend_night", "unknown",
] as const;
export type TimeBucket = (typeof TIME_BUCKETS)[number];

export const EQUIPMENT_TYPES = [
  "DRUM_SET", "GUITAR_AMP", "BASS_AMP", "KEYBOARD", "MIC", "PA_SYSTEM",
  "MIXER", "CYMBAL", "DOUBLE_PEDAL", "PEDAL_BOARD", "STAND", "OTHER",
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const STUDIO_STATUSES = ["candidate", "approved", "hidden", "closed"] as const;
export type StudioStatus = (typeof STUDIO_STATUSES)[number];

// 한국어 라벨 (UI/관리 폼 공용)
export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  DRUM_SET: "드럼셋", GUITAR_AMP: "기타 앰프", BASS_AMP: "베이스 앰프",
  KEYBOARD: "키보드", MIC: "마이크", PA_SYSTEM: "PA 시스템", MIXER: "믹서",
  CYMBAL: "심벌", DOUBLE_PEDAL: "더블 페달", PEDAL_BOARD: "페달보드",
  STAND: "스탠드", OTHER: "기타",
};

export const transportModeEnum = z.enum(TRANSPORT_MODES as unknown as [TransportMode, ...TransportMode[]]);
export const originTypeEnum = z.enum(ORIGIN_TYPES as unknown as [OriginType, ...OriginType[]]);
export const equipmentTypeEnum = z.enum(EQUIPMENT_TYPES as unknown as [EquipmentType, ...EquipmentType[]]);
export const studioStatusEnum = z.enum(STUDIO_STATUSES as unknown as [StudioStatus, ...StudioStatus[]]);

// ── 도메인 타입 ──────────────────────────────────────────────────────────
export type GeoPoint = { lat: number; lng: number };

export type StudioEquipment = {
  equipmentType: EquipmentType;
  equipmentName: string | null;
  quantity: number;
  note: string | null;
};

export type StudioRoom = {
  id: number;
  name: string;
  hourlyPrice: number | null;
  capacity: number | null;
  equipment: RoomGear[];
  review: string | null;
};

export type Studio = {
  id: number;
  name: string;
  slug: string;
  regionId: number | null;
  regionName: string | null;
  areaLabel: string | null;
  lat: number;
  lng: number;
  nearestStation: string | null;
  nearestStationMeters: number | null;
  hourlyPriceMin: number | null;
  hourlyPriceMax: number | null;
  minCapacity: number | null;
  maxCapacity: number | null;
  hasParking: boolean;
  parkingNote: string | null;
  status: StudioStatus;
  sourceNote: string | null;
  bookingUrl: string | null;
  mapUrl: string | null;
  imageUrl: string | null;
  equipment: StudioEquipment[];
  roadAddress: string | null;
  phone: string | null;
  bookingMethod: string | null;
  amenities: string | null;
  homepageUrl: string | null;
  rooms: StudioRoom[];
  equipmentTypes: RoomEquipmentType[];
};

export type SearchMemberInput = {
  nickname: string;
  originText: string;
  originLat: number;
  originLng: number;
  originType: OriginType;
  transportMode: TransportMode;
};

export type RecommendInput = {
  transportMode: TransportMode;
  maxBudgetPerHour: number | null;
  requiredEquipment: EquipmentType[];
  preferredRegionIds: number[];
  members: SearchMemberInput[];
};

export type RouteResult = {
  travelMinutes: number;
  transferCount: number;
  walkingMinutes: number;
  fare: number | null;
  distanceMeters: number;
  provider: RouteProviderName;
};

export type MemberRoute = {
  nickname: string;
  route: RouteResult;
};

export const ROOM_EQUIPMENT_TYPES = ["DRUM", "GUITAR_AMP", "BASS_AMP", "KEYBOARD", "ETC"] as const;
export type RoomEquipmentType = (typeof ROOM_EQUIPMENT_TYPES)[number];
export const ROOM_EQUIPMENT_LABELS: Record<RoomEquipmentType, string> = {
  DRUM: "드럼", GUITAR_AMP: "기타앰프", BASS_AMP: "베이스앰프", KEYBOARD: "키보드", ETC: "그외",
};
export type RoomGear = { name: string; type: RoomEquipmentType };

// 방들의 장비 타입 합집합 (ROOM_EQUIPMENT_TYPES 정의 순서 유지)
export function roomEquipmentTypes(rooms: { equipment: RoomGear[] }[]): RoomEquipmentType[] {
  const present = new Set<RoomEquipmentType>();
  for (const r of rooms) for (const g of r.equipment) present.add(g.type);
  return ROOM_EQUIPMENT_TYPES.filter((t) => present.has(t));
}
