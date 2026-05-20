import { randomBytes } from "node:crypto";

const TOKEN_RE = /^[a-f0-9]{32}$/;

export function generateToken(): string {
  return randomBytes(16).toString("hex");
}

export function isValidToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}
