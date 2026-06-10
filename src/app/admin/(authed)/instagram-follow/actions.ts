"use server";
import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/auth";
import { setHofVisibility } from "@/lib/playground/instagram/hofDb";

async function requireAuth() {
  if (!(await readSession())) throw new Error("UNAUTHENTICATED");
}

export async function hideEntry(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await setHofVisibility(id, false);
  revalidatePath("/admin/instagram-follow");
}

export async function showEntry(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await setHofVisibility(id, true);
  revalidatePath("/admin/instagram-follow");
}
