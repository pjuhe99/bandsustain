import "server-only";
import { readFileSync } from "node:fs";

const DEFAULT_PATH = "/var/www/html/_______site_BANDSUSTAIN/.db_credentials";

export function loadCreds(): Record<string, string> {
  const path = process.env.DB_CREDENTIALS_PATH ?? DEFAULT_PATH;
  const raw = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

export function requireCred(key: string): string {
  const c = loadCreds();
  const v = c[key];
  if (!v) throw new Error(`Missing credential: ${key}`);
  return v;
}
