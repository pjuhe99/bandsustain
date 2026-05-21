"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import {
  createMemberPin,
  updateMemberPin,
  deleteMemberPin,
  swapMemberPinOrder,
  lookupLayoutForPin,
  type LayoutLookup,
} from "@/lib/playground/memberPins";

const TITLE_MAX = 200;
const CAPTION_MAX = 200;

async function requireAuth() {
  const s = await readSession();
  if (!s) throw new Error("UNAUTHENTICATED");
}

const createSchema = z.object({
  member_id: z.coerce.number().int().positive(),
  layout_id: z.coerce.number().int().positive(),
  override_title: z.string().max(TITLE_MAX, `제목은 ${TITLE_MAX}자 이내로 입력해주세요`).optional().or(z.literal("")),
  caption: z.string().max(CAPTION_MAX, `캡션은 ${CAPTION_MAX}자 이내로 입력해주세요`).optional().or(z.literal("")),
});

const updateSchema = z.object({
  member_id: z.coerce.number().int().positive(),
  override_title: z.string().max(TITLE_MAX, `제목은 ${TITLE_MAX}자 이내로 입력해주세요`).optional().or(z.literal("")),
  caption: z.string().max(CAPTION_MAX, `캡션은 ${CAPTION_MAX}자 이내로 입력해주세요`).optional().or(z.literal("")),
});

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

function fromCreate(fd: FormData) {
  return {
    member_id: fd.get("member_id"),
    layout_id: fd.get("layout_id"),
    override_title: fd.get("override_title") ?? "",
    caption: fd.get("caption") ?? "",
  };
}

function fromUpdate(fd: FormData) {
  return {
    member_id: fd.get("member_id"),
    override_title: fd.get("override_title") ?? "",
    caption: fd.get("caption") ?? "",
  };
}

function buildFieldErrors(issues: z.ZodIssue[]): Record<string, string> {
  const fe: Record<string, string> = {};
  for (const issue of issues) fe[issue.path.join(".")] = issue.message;
  return fe;
}

export async function createPinAction(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = createSchema.safeParse(fromCreate(fd));
  if (!parsed.success) {
    return { error: "검증 실패", fieldErrors: buildFieldErrors(parsed.error.issues) };
  }
  const { layout_id, member_id, override_title, caption } = parsed.data;
  const res = await createMemberPin({
    layout_id,
    member_id,
    override_title: override_title || null,
    caption: caption || null,
  });
  if (!res.ok) {
    if (res.code === "LAYOUT_NOT_FOUND") {
      return { error: `layout id #${layout_id}는 존재하지 않습니다`, fieldErrors: { layout_id: "존재하지 않는 layout id" } };
    }
    if (res.code === "MEMBER_NOT_FOUND") {
      return { error: "멤버를 다시 선택해주세요", fieldErrors: { member_id: "존재하지 않는 멤버" } };
    }
    if (res.code === "DUPLICATE") {
      return {
        error: res.existingPinId
          ? `이 멤버에게 이미 등록된 페달보드입니다 (pin #${res.existingPinId})`
          : "이 멤버에게 이미 등록된 페달보드입니다",
        fieldErrors: { layout_id: "이 조합은 이미 등록됨" },
      };
    }
  }
  revalidatePath("/admin/pedalboard-pins");
  revalidatePath("/playground/pedalboard-planner/gallery");
  return {};
}

export async function updatePinAction(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = updateSchema.safeParse(fromUpdate(fd));
  if (!parsed.success) {
    return { error: "검증 실패", fieldErrors: buildFieldErrors(parsed.error.issues) };
  }
  const { member_id, override_title, caption } = parsed.data;
  const res = await updateMemberPin(id, {
    member_id,
    override_title: override_title || null,
    caption: caption || null,
  });
  if (!res.ok) {
    if (res.code === "PIN_NOT_FOUND") return { error: "이미 삭제된 핀입니다" };
    if (res.code === "MEMBER_NOT_FOUND") {
      return { error: "멤버를 다시 선택해주세요", fieldErrors: { member_id: "존재하지 않는 멤버" } };
    }
    if (res.code === "DUPLICATE") {
      return {
        error: res.existingPinId
          ? `이 멤버에게 이미 등록된 페달보드입니다 (pin #${res.existingPinId})`
          : "이 멤버에게 이미 등록된 페달보드입니다",
        fieldErrors: { member_id: "이 조합은 이미 등록됨" },
      };
    }
  }
  revalidatePath("/admin/pedalboard-pins");
  revalidatePath(`/admin/pedalboard-pins/${id}`);
  revalidatePath("/playground/pedalboard-planner/gallery");
  redirect("/admin/pedalboard-pins");
}

export async function deletePinAction(id: number) {
  await requireAuth();
  await deleteMemberPin(id);
  revalidatePath("/admin/pedalboard-pins");
  revalidatePath("/playground/pedalboard-planner/gallery");
}

export async function swapPinOrderAction(id: number, direction: "up" | "down") {
  await requireAuth();
  await swapMemberPinOrder(id, direction);
  revalidatePath("/admin/pedalboard-pins");
  revalidatePath("/playground/pedalboard-planner/gallery");
}

export async function lookupLayoutAction(layoutId: number): Promise<{ ok: true; layout: LayoutLookup } | { ok: false; error: string }> {
  await requireAuth();
  if (!Number.isFinite(layoutId) || layoutId <= 0) {
    return { ok: false, error: "올바른 layout id를 입력해주세요" };
  }
  const lookup = await lookupLayoutForPin(layoutId);
  if (!lookup) return { ok: false, error: `layout id #${layoutId}는 존재하지 않습니다` };
  if (!lookup.has_snapshot) return { ok: false, error: `layout #${layoutId}는 아직 저장되지 않은 보드입니다` };
  return { ok: true, layout: lookup };
}
