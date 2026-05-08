"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import {
  createLiveEvent,
  updateLiveEvent,
  togglePublishedLiveEvent,
  type LiveEventInput,
} from "@/lib/live";

const liveSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식"),
  venue: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  ticketUrl: z
    .string()
    .max(500)
    .url("URL 형식")
    .nullable()
    .or(z.literal("").transform(() => null)),
  videoUrl: z
    .string()
    .max(500)
    .url("URL 형식")
    .nullable()
    .or(z.literal("").transform(() => null)),
  published: z.boolean(),
});

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}

function fromForm(fd: FormData) {
  return {
    eventDate: fd.get("eventDate"),
    venue: fd.get("venue"),
    city: fd.get("city"),
    ticketUrl: fd.get("ticketUrl") ?? "",
    videoUrl: fd.get("videoUrl") ?? "",
    published: fd.get("published") === "on",
  };
}

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

function revalidateAll(id?: number) {
  revalidatePath("/admin/live");
  if (id !== undefined) revalidatePath(`/admin/live/${id}`);
  revalidatePath("/admin");
  revalidatePath("/live");
}

export async function createLive(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = liveSchema.safeParse(fromForm(fd));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) fe[issue.path.join(".")] = issue.message;
    return { error: "검증 실패", fieldErrors: fe };
  }
  const input: LiveEventInput = parsed.data;
  await createLiveEvent(input);
  revalidateAll();
  redirect("/admin/live");
}

export async function updateLive(
  id: number,
  _p: FormState,
  fd: FormData,
): Promise<FormState> {
  await requireAuth();
  const parsed = liveSchema.safeParse(fromForm(fd));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) fe[issue.path.join(".")] = issue.message;
    return { error: "검증 실패", fieldErrors: fe };
  }
  const input: LiveEventInput = parsed.data;
  await updateLiveEvent(id, input);
  revalidateAll(id);
  redirect("/admin/live");
}

export async function togglePublishedLive(id: number) {
  await requireAuth();
  await togglePublishedLiveEvent(id);
  revalidateAll(id);
}
