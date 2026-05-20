#!/usr/bin/env -S tsx
// scripts/playground-invariants.ts
//
// Verifies structural invariants for playground_layouts and playground_layout_items.
// Spec §9.
//
// Usage:
//   pnpm playground:invariants
//   pnpm playground:invariants -- --creds=/path/to/.db_credentials

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

  const checks: { name: string; sql: string }[] = [
    {
      name: "xor invariant (layouts)",
      sql: `SELECT COUNT(*) AS n FROM playground_layouts
            WHERE (board_kind='catalog' AND (catalog_board_id IS NULL OR custom_board_id IS NOT NULL))
               OR (board_kind='custom'  AND (custom_board_id  IS NULL OR catalog_board_id IS NOT NULL))`,
    },
    {
      name: "xor invariant (layout_items)",
      sql: `SELECT COUNT(*) AS n FROM playground_layout_items
            WHERE (item_kind='catalog' AND (catalog_pedal_id IS NULL OR custom_item_id IS NOT NULL))
               OR (item_kind='custom'  AND (custom_item_id  IS NULL OR catalog_pedal_id IS NOT NULL))`,
    },
    {
      name: "snapshot/normalized sync (item count match)",
      sql: `SELECT COUNT(*) AS n FROM playground_layouts l
            WHERE l.snapshot_json IS NOT NULL
              AND JSON_LENGTH(l.snapshot_json, '$.items')
                  <> (SELECT COUNT(*) FROM playground_layout_items li WHERE li.layout_id = l.id)`,
    },
    {
      name: "share_token uniqueness (count distinct = count rows)",
      sql: `SELECT (COUNT(*) - COUNT(DISTINCT share_token)) AS n FROM playground_layouts`,
    },
  ];

  let failed = 0;
  for (const ck of checks) {
    const [rows] = await conn.query<any[]>(ck.sql);
    const n = Number(rows[0]?.n ?? 0);
    const ok = n === 0;
    console.log(`${ok ? "OK  " : "FAIL"}  ${ck.name}  (n=${n})`);
    if (!ok) failed += 1;
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
