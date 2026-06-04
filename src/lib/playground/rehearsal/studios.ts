import "server-only";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import type { Studio, StudioStatus, StudioEquipment, EquipmentType } from "./types";
import { loadRoomsByStudioIds } from "./rooms";
import { roomEquipmentTypes } from "./types";

function mapStudioRow(r: RowDataPacket): Omit<Studio, "equipment" | "rooms" | "equipmentTypes"> {
  return {
    id: r.id, name: r.name, slug: r.slug, regionId: r.region_id, regionName: r.region_name ?? null,
    areaLabel: r.area_label, roadAddress: r.road_address ?? null,
    lat: r.lat != null ? Number(r.lat) : NaN, lng: r.lng != null ? Number(r.lng) : NaN,
    nearestStation: r.nearest_station, nearestStationMeters: r.nearest_station_meters,
    hourlyPriceMin: r.hourly_price_min, hourlyPriceMax: r.hourly_price_max,
    minCapacity: r.min_capacity, maxCapacity: r.max_capacity,
    hasParking: r.has_parking === 1, parkingNote: r.parking_note,
    status: r.status as StudioStatus, sourceNote: r.source_note,
    bookingUrl: r.booking_url, mapUrl: r.map_url,
    bookingMethod: r.booking_method ?? null, amenities: r.amenities ?? null, homepageUrl: r.homepage_url ?? null,
  };
}

async function attachEquipment(
  studios: Omit<Studio, "equipment" | "rooms" | "equipmentTypes">[],
): Promise<Omit<Studio, "rooms" | "equipmentTypes">[]> {
  if (studios.length === 0) return [];
  const ids = studios.map((s) => s.id);
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT studio_id, equipment_type, equipment_name, quantity, note
       FROM playground_studio_equipment
      WHERE studio_id IN (${ids.map(() => "?").join(",")})
      ORDER BY id`,
    ids,
  );
  const byStudio = new Map<number, StudioEquipment[]>();
  for (const r of rows) {
    const list = byStudio.get(r.studio_id) ?? [];
    list.push({
      equipmentType: r.equipment_type as EquipmentType, equipmentName: r.equipment_name,
      quantity: r.quantity, note: r.note,
    });
    byStudio.set(r.studio_id, list);
  }
  return studios.map((s) => ({ ...s, equipment: byStudio.get(s.id) ?? [] }));
}

async function attachRooms(studios: Omit<Studio, "rooms" | "equipmentTypes">[]): Promise<Studio[]> {
  if (studios.length === 0) return [];
  const roomsByStudio = await loadRoomsByStudioIds(studios.map((s) => s.id));
  return studios.map((s) => {
    const rooms = roomsByStudio.get(s.id) ?? [];
    return { ...s, rooms, equipmentTypes: roomEquipmentTypes(rooms) };
  });
}

const SELECT_STUDIO = `
  SELECT st.id, st.name, st.slug, st.region_id, rg.display_name AS region_name, st.area_label,
         st.road_address, st.lat, st.lng, st.nearest_station, st.nearest_station_meters,
         st.hourly_price_min, st.hourly_price_max, st.min_capacity, st.max_capacity,
         st.has_parking, st.parking_note, st.status, st.source_note, st.booking_url, st.map_url,
         st.booking_method, st.amenities, st.homepage_url
    FROM playground_studios st
    LEFT JOIN playground_regions rg ON rg.id = st.region_id`;

export async function getCandidateStudios(): Promise<Studio[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `${SELECT_STUDIO} WHERE st.status = 'approved' AND st.lat IS NOT NULL AND st.lng IS NOT NULL`,
  );
  return attachRooms(await attachEquipment(rows.map(mapStudioRow)));
}

export async function listStudios(filter: {
  regionId?: number; status?: StudioStatus; keyword?: string; equipmentType?: EquipmentType;
}): Promise<Studio[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.regionId) { clauses.push("st.region_id = ?"); params.push(filter.regionId); }
  if (filter.status) { clauses.push("st.status = ?"); params.push(filter.status); }
  if (filter.keyword) { clauses.push("st.name LIKE ?"); params.push(`%${filter.keyword}%`); }
  if (filter.equipmentType) {
    clauses.push("EXISTS (SELECT 1 FROM playground_studio_equipment e WHERE e.studio_id = st.id AND e.equipment_type = ?)");
    params.push(filter.equipmentType);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const [rows] = await getPool().query<RowDataPacket[]>(
    `${SELECT_STUDIO} ${where} ORDER BY st.updated_at DESC, st.id DESC`,
    params,
  );
  return attachRooms(await attachEquipment(rows.map(mapStudioRow)));
}

export async function getStudioById(id: number): Promise<Studio | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(`${SELECT_STUDIO} WHERE st.id = ?`, [id]);
  if (rows.length === 0) return null;
  return (await attachRooms(await attachEquipment([mapStudioRow(rows[0])])))[0] ?? null;
}

export type StudioWriteInput = {
  name: string; slug: string; regionId: number | null; areaLabel: string | null;
  lat: number | null; lng: number | null; nearestStation: string | null; nearestStationMeters: number | null;
  hourlyPriceMin: number | null; hourlyPriceMax: number | null; minCapacity: number | null; maxCapacity: number | null;
  hasParking: boolean; parkingNote: string | null; status: StudioStatus; sourceNote: string | null;
  bookingUrl: string | null; mapUrl: string | null;
  equipment: { equipmentType: EquipmentType; equipmentName: string | null; quantity: number; note: string | null }[];
};

export async function createStudio(input: StudioWriteInput): Promise<number> {
  const [res] = await getPool().query<ResultSetHeader>(
    `INSERT INTO playground_studios
       (name, slug, region_id, area_label, lat, lng, nearest_station, nearest_station_meters,
        hourly_price_min, hourly_price_max, min_capacity, max_capacity, has_parking, parking_note,
        status, source_note, booking_url, map_url)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [input.name, input.slug, input.regionId, input.areaLabel, input.lat, input.lng, input.nearestStation,
     input.nearestStationMeters, input.hourlyPriceMin, input.hourlyPriceMax, input.minCapacity, input.maxCapacity,
     input.hasParking ? 1 : 0, input.parkingNote, input.status, input.sourceNote, input.bookingUrl, input.mapUrl],
  );
  const studioId = res.insertId;
  await replaceEquipment(studioId, input.equipment);
  return studioId;
}

export async function updateStudio(id: number, input: StudioWriteInput): Promise<void> {
  await getPool().query(
    `UPDATE playground_studios SET
       name=?, slug=?, region_id=?, area_label=?, lat=?, lng=?, nearest_station=?, nearest_station_meters=?,
       hourly_price_min=?, hourly_price_max=?, min_capacity=?, max_capacity=?, has_parking=?, parking_note=?,
       status=?, source_note=?, booking_url=?, map_url=?
     WHERE id=?`,
    [input.name, input.slug, input.regionId, input.areaLabel, input.lat, input.lng, input.nearestStation,
     input.nearestStationMeters, input.hourlyPriceMin, input.hourlyPriceMax, input.minCapacity, input.maxCapacity,
     input.hasParking ? 1 : 0, input.parkingNote, input.status, input.sourceNote, input.bookingUrl, input.mapUrl, id],
  );
  await replaceEquipment(id, input.equipment);
}

async function replaceEquipment(studioId: number, equipment: StudioWriteInput["equipment"]): Promise<void> {
  await getPool().query(`DELETE FROM playground_studio_equipment WHERE studio_id = ?`, [studioId]);
  for (const e of equipment) {
    await getPool().query(
      `INSERT INTO playground_studio_equipment (studio_id, equipment_type, equipment_name, quantity, note)
       VALUES (?,?,?,?,?)`,
      [studioId, e.equipmentType, e.equipmentName, e.quantity, e.note],
    );
  }
}
