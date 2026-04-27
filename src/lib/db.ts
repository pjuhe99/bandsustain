import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

function loadCreds(): Record<string, string> {
  const path = process.env.DB_CREDENTIALS_PATH
    ?? "/var/www/html/_______site_BANDSUSTAIN/.db_credentials";
  const raw = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function createPool(): mysql.Pool {
  const c = loadCreds();
  return mysql.createPool({
    host: c.DB_HOST,
    user: c.DB_USER,
    password: c.DB_PASS,
    database: c.DB_NAME,
    connectionLimit: 5,
    waitForConnections: true,
    charset: "utf8mb4",
  });
}

const g = globalThis as unknown as { __bs_pool?: mysql.Pool };

export function getPool(): mysql.Pool {
  return g.__bs_pool ?? (g.__bs_pool = createPool());
}
