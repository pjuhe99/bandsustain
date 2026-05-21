#!/usr/bin/env -S tsx
// scripts/verify-member-pins.ts
//
// Verifies structural invariants for playground_member_pins.
//
// Usage:
//   pnpm pins:verify
//   pnpm pins:verify -- --creds=/path/to/.db_credentials

import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

function loadCreds(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  for (const k of ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"]) {
    if (!out[k]) throw new Error(`Missing ${k} in credentials file`);
  }
  return out;
}

async function main() {
  const credsArg = process.argv.find((a) => a.startsWith("--creds="));
  const path =
    credsArg
      ? credsArg.slice("--creds=".length)
      : process.env.DB_CREDENTIALS_PATH
        ?? "/var/www/html/_______site_BANDSUSTAIN/.db_credentials";
  const c = loadCreds(path);
  const conn = await mysql.createConnection({
    host: c.DB_HOST,
    user: c.DB_USER,
    password: c.DB_PASS,
    database: c.DB_NAME,
  });

  const failChecks: { name: string; sql: string }[] = [
    {
      name: "no orphan layout_id (FK)",
      sql: `SELECT COUNT(*) AS n FROM playground_member_pins p
             LEFT JOIN playground_layouts l ON l.id = p.layout_id
            WHERE l.id IS NULL`,
    },
    {
      name: "no orphan member_id (FK)",
      sql: `SELECT COUNT(*) AS n FROM playground_member_pins p
             LEFT JOIN members m ON m.id = p.member_id
            WHERE m.id IS NULL`,
    },
    {
      name: "UNIQUE (layout_id, member_id) holds",
      sql: `SELECT COUNT(*) AS n FROM (
              SELECT layout_id, member_id FROM playground_member_pins
              GROUP BY layout_id, member_id HAVING COUNT(*) > 1
            ) dup`,
    },
    {
      name: "all pinned layouts have snapshot_json",
      sql: `SELECT COUNT(*) AS n FROM playground_member_pins p
             JOIN playground_layouts l ON l.id = p.layout_id
            WHERE l.snapshot_json IS NULL`,
    },
  ];

  const warnChecks: { name: string; sql: string }[] = [
    {
      name: "pins for unpublished members (warning only)",
      sql: `SELECT COUNT(*) AS n FROM playground_member_pins p
             JOIN members m ON m.id = p.member_id
            WHERE m.published = 0`,
    },
  ];

  let failed = 0;
  for (const ck of failChecks) {
    const [rows] = await conn.query<any[]>(ck.sql);
    const n = Number(rows[0]?.n ?? 0);
    const ok = n === 0;
    console.log(`${ok ? "OK  " : "FAIL"}  ${ck.name}  (n=${n})`);
    if (!ok) failed += 1;
  }
  for (const ck of warnChecks) {
    const [rows] = await conn.query<any[]>(ck.sql);
    const n = Number(rows[0]?.n ?? 0);
    if (n > 0) console.log(`WARN  ${ck.name}  (n=${n})`);
    else console.log(`OK    ${ck.name}  (n=${n})`);
  }

  await conn.end();
  if (failed > 0) {
    console.error(`${failed} invariant(s) FAILED`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
