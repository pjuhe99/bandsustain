"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setSessionCookie, verifyAdminPassword } from "@/lib/auth";

const schema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { error: "잘못된 입력" };
  }
  const ok = await verifyAdminPassword(parsed.data.username, parsed.data.password);
  if (!ok) {
    return { error: "ID 또는 비밀번호가 올바르지 않습니다" };
  }
  await setSessionCookie(parsed.data.username);

  const next = parsed.data.next && parsed.data.next.startsWith("/admin")
    ? parsed.data.next
    : "/admin";
  redirect(next);
}
