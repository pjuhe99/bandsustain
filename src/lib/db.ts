import "server-only";
import mysql from "mysql2/promise";
import { loadCreds } from "./creds";

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
