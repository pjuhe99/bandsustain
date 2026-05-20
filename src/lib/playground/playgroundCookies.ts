import "server-only";
import { cookies } from "next/headers";
import { generateToken, isValidToken } from "./tokens";

const COOKIE_NAME = "playground_owner";
const TEN_YEARS_S = 60 * 60 * 24 * 365 * 10;

export async function getOwnerToken(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(COOKIE_NAME)?.value ?? null;
  return v && isValidToken(v) ? v : null;
}

export async function getOrCreateOwnerToken(): Promise<string> {
  const c = await cookies();
  const existing = c.get(COOKIE_NAME)?.value;
  if (existing && isValidToken(existing)) return existing;
  const fresh = generateToken();
  c.set(COOKIE_NAME, fresh, {
    httpOnly: true,
    sameSite: "lax",
    path: "/playground",
    maxAge: TEN_YEARS_S,
    secure: true,
  });
  return fresh;
}
