"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import { createStudio, updateStudio, type StudioWriteInput } from "@/lib/playground/rehearsal/studios";
import { equipmentTypeEnum, studioStatusEnum } from "@/lib/playground/rehearsal/types";

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

function parseEquipment(fd: FormData): StudioWriteInput["equipment"] {
  const types = fd.getAll("equipmentType").map(String);
  const names = fd.getAll("equipmentName").map(String);
  const qtys = fd.getAll("equipmentQty").map(String);
  const out: StudioWriteInput["equipment"] = [];
  for (let i = 0; i < types.length; i++) {
    const t = equipmentTypeEnum.safeParse(types[i]);
    if (!t.success || !types[i]) continue;
    out.push({
      equipmentType: t.data,
      equipmentName: names[i] && names[i] !== "" ? names[i] : null,
      quantity: Number(qtys[i]) > 0 ? Number(qtys[i]) : 1,
      note: null,
    });
  }
  return out;
}

function fromForm(fd: FormData) {
  return {
    name: fd.get("name") ?? "", slug: fd.get("slug") ?? "",
    regionId: fd.get("regionId"), areaLabel: fd.get("areaLabel"),
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
  await createStudio({ ...r.data, equipment: parseEquipment(fd) });
  revalidatePath("/admin/rehearsal-studios");
  redirect("/admin/rehearsal-studios");
}

export async function updateRehearsalStudio(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = StudioSchema.safeParse(fromForm(fd));
  if (!r.success) return validationErrors(r);
  await updateStudio(id, { ...r.data, equipment: parseEquipment(fd) });
  revalidatePath("/admin/rehearsal-studios");
  revalidatePath(`/admin/rehearsal-studios/${id}`);
  redirect("/admin/rehearsal-studios");
}
