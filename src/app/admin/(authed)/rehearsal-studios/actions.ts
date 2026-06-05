"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import { createStudio, updateStudio, deleteStudio, type StudioWriteInput } from "@/lib/playground/rehearsal/studios";
import { studioStatusEnum } from "@/lib/playground/rehearsal/types";
import { parseRoomRows, deriveStudioStats, type RoomRowInput } from "@/lib/playground/rehearsal/adminRooms";

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}

const intOrNull = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().int().nullable(),
);
const floatOrNull = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().finite().nullable(),
);
const strOrNull = z.preprocess(
  (v) => (v === "" || v == null ? null : String(v)),
  z.string().nullable(),
);

const StudioSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(180).regex(/^[a-z0-9-]+$/, "소문자/숫자/하이픈만"),
  regionId: intOrNull,
  areaLabel: strOrNull,
  roadAddress: strOrNull,
  phone: strOrNull,
  bookingMethod: strOrNull,
  amenities: strOrNull,
  homepageUrl: strOrNull,
  lat: floatOrNull,
  lng: floatOrNull,
  nearestStation: strOrNull,
  nearestStationMeters: intOrNull,
  hourlyPriceMin: intOrNull,
  hourlyPriceMax: intOrNull,
  minCapacity: intOrNull,
  maxCapacity: intOrNull,
  hasParking: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  parkingNote: strOrNull,
  status: studioStatusEnum,
  sourceNote: strOrNull,
  bookingUrl: strOrNull,
  mapUrl: strOrNull,
});

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

function parseRooms(fd: FormData): RoomRowInput[] {
  const names = fd.getAll("roomName").map(String);
  const prices = fd.getAll("roomPrice").map(String);
  const caps = fd.getAll("roomCapacity").map(String);
  const gears = fd.getAll("roomGear").map(String);
  const reviews = fd.getAll("roomReview").map(String);
  return names.map((name, i) => ({
    name, price: prices[i] ?? "", capacity: caps[i] ?? "", gear: gears[i] ?? "", review: reviews[i] ?? "",
  }));
}

// 방이 1개 이상이면 합주실 가격(min/max)·최대 인원은 방에서 파생 (폼 입력 무시)
function buildInput(data: z.infer<typeof StudioSchema>, fd: FormData): StudioWriteInput {
  const rooms = parseRoomRows(parseRooms(fd));
  const derived = rooms.length > 0 ? deriveStudioStats(rooms) : null;
  return {
    ...data,
    hourlyPriceMin: derived ? derived.priceMin : data.hourlyPriceMin,
    hourlyPriceMax: derived ? derived.priceMax : data.hourlyPriceMax,
    maxCapacity: derived ? derived.capacityMax : data.maxCapacity,
    rooms,
  };
}

function fromForm(fd: FormData) {
  return {
    name: fd.get("name") ?? "", slug: fd.get("slug") ?? "",
    regionId: fd.get("regionId"), areaLabel: fd.get("areaLabel"),
    roadAddress: fd.get("roadAddress"), phone: fd.get("phone"),
    bookingMethod: fd.get("bookingMethod"), amenities: fd.get("amenities"), homepageUrl: fd.get("homepageUrl"),
    lat: fd.get("lat"), lng: fd.get("lng"),
    nearestStation: fd.get("nearestStation"), nearestStationMeters: fd.get("nearestStationMeters"),
    hourlyPriceMin: fd.get("hourlyPriceMin"), hourlyPriceMax: fd.get("hourlyPriceMax"),
    minCapacity: fd.get("minCapacity"), maxCapacity: fd.get("maxCapacity"),
    hasParking: fd.get("hasParking"), parkingNote: fd.get("parkingNote"),
    status: fd.get("status") ?? "candidate", sourceNote: fd.get("sourceNote"),
    bookingUrl: fd.get("bookingUrl"), mapUrl: fd.get("mapUrl"),
  };
}

function validationErrors(r: z.ZodSafeParseError<unknown>): FormState {
  const fe: Record<string, string> = {};
  for (const issue of r.error.issues) fe[issue.path.join(".")] = issue.message;
  return { error: "검증 실패", fieldErrors: fe };
}

export async function createRehearsalStudio(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = StudioSchema.safeParse(fromForm(fd));
  if (!r.success) return validationErrors(r);
  await createStudio(buildInput(r.data, fd));
  revalidatePath("/admin/rehearsal-studios");
  redirect("/admin/rehearsal-studios");
}

export async function updateRehearsalStudio(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = StudioSchema.safeParse(fromForm(fd));
  if (!r.success) return validationErrors(r);
  await updateStudio(id, buildInput(r.data, fd));
  revalidatePath("/admin/rehearsal-studios");
  revalidatePath(`/admin/rehearsal-studios/${id}`);
  redirect("/admin/rehearsal-studios");
}

export async function deleteRehearsalStudio(id: number): Promise<void> {
  await requireAuth();
  await deleteStudio(id);
  revalidatePath("/admin/rehearsal-studios");
  redirect("/admin/rehearsal-studios");
}
