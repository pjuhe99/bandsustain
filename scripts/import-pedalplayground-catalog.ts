#!/usr/bin/env -S tsx
// scripts/import-pedalplayground-catalog.ts
//
// Pedal Playground (https://github.com/PedalPlayground/pedalplayground) 의
// public/data/{pedals,pedalboards}.json 을 bandsustain DB 의
// playground_pedals / playground_boards 로 import 한다.
//
// 안정 식별자: (brand, name). width/height/image 같은 mutable 필드는 식별자에 포함하지 않는다.
//
// 사용 예:
//   pnpm playground:import-catalog -- --pedals=/tmp/pedals.json --dry-run
//   pnpm playground:import-catalog -- --pedals=/tmp/pedals.json --boards=/tmp/pedalboards.json --deactivate-missing
//   pnpm playground:import-catalog -- --pedals=/tmp/pedals.json --strict
//
// 플래그:
//   --pedals=<path>             pedals.json 경로 (없으면 pedal kind skip)
//   --boards=<path>             pedalboards.json 경로 (없으면 board kind skip)
//   --dry-run                   트랜잭션을 ROLLBACK. 출력 카운트만 보고 실제 변경 없음.
//   --deactivate-missing        이번 import 에서 보지 못한 active row 를 is_active=0 처리.
//   --strict                    JSON row validation 실패 1건이라도 있으면 종료(exit 2).
//   --creds=<path>              .db_credentials 파일 경로 override (기본: DB_CREDENTIALS_PATH or 표준 위치).

import { readFileSync } from "node:fs";
import { argv, exit } from "node:process";
import mysql from "mysql2/promise";
import type { Pool, PoolConnection } from "mysql2/promise";
import {
  type CatalogKind,
  type CatalogSourceRow,
  type ImportCounters,
  deactivateMissing,
  emptyCounters,
  normalizeRow,
  upsertBrand,
  upsertItem,
} from "../src/lib/playgroundCatalogImport";

type Args = {
  pedals: string | null;
  boards: string | null;
  dryRun: boolean;
  deactivateMissing: boolean;
  strict: boolean;
  credsPath: string | null;
};

function parseArgs(rawArgs: readonly string[]): Args {
  const out: Args = {
    pedals: null,
    boards: null,
    dryRun: false,
    deactivateMissing: false,
    strict: false,
    credsPath: null,
  };
  for (const a of rawArgs) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--deactivate-missing") out.deactivateMissing = true;
    else if (a === "--strict") out.strict = true;
    else if (a.startsWith("--pedals=")) out.pedals = a.slice("--pedals=".length);
    else if (a.startsWith("--boards=")) out.boards = a.slice("--boards=".length);
    else if (a.startsWith("--creds=")) out.credsPath = a.slice("--creds=".length);
    else if (a === "--help" || a === "-h") {
      printUsage();
      exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      printUsage();
      exit(2);
    }
  }
  if (out.pedals === null && out.boards === null) {
    console.error("Provide at least one of --pedals=<path> or --boards=<path>");
    printUsage();
    exit(2);
  }
  return out;
}

function printUsage(): void {
  console.log(
    [
      "Usage:",
      "  tsx scripts/import-pedalplayground-catalog.ts --pedals=<path> [--boards=<path>] [options]",
      "",
      "Options:",
      "  --pedals=<path>          pedals.json source",
      "  --boards=<path>          pedalboards.json source",
      "  --dry-run                roll back transaction (no writes persist)",
      "  --deactivate-missing     mark unseen active rows as is_active=0",
      "  --strict                 exit non-zero on any row validation failure",
      "  --creds=<path>           override .db_credentials path",
    ].join("\n"),
  );
}

function loadCreds(overridePath: string | null): Record<string, string> {
  const path = overridePath
    ?? process.env.DB_CREDENTIALS_PATH
    ?? "/var/www/html/_______site_BANDSUSTAIN/.db_credentials";
  const raw = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  for (const k of ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"]) {
    if (!out[k]) throw new Error(`Missing ${k} in credentials file`);
  }
  return out;
}

function readCatalog(path: string): CatalogSourceRow[] {
  const raw = readFileSync(path, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array at top level of ${path}`);
  }
  return parsed as CatalogSourceRow[];
}

type ProcessResult = {
  counters: ImportCounters;
  seenIds: Set<number>;
  validationErrors: { index: number; row: CatalogSourceRow }[];
};

async function processKind(
  conn: PoolConnection,
  kind: CatalogKind,
  rows: CatalogSourceRow[],
): Promise<ProcessResult> {
  const counters = emptyCounters();
  const seenIds = new Set<number>();
  const validationErrors: ProcessResult["validationErrors"] = [];

  // brand_id 캐시: 같은 import 내에서 동일 브랜드 lookup 반복 회피
  const brandIdByName = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const item = normalizeRow(raw);
    if (item === null) {
      validationErrors.push({ index: i, row: raw });
      counters.itemsSkipped += 1;
      continue;
    }
    let brandId = brandIdByName.get(item.brand);
    if (brandId === undefined) {
      brandId = await upsertBrand(
        conn,
        kind,
        item.brand,
        item.brandSlug,
        item.brandSearchName,
        counters,
      );
      brandIdByName.set(item.brand, brandId);
    }
    const result = await upsertItem(conn, kind, item, brandId, counters);
    seenIds.add(result.id);
  }

  return { counters, seenIds, validationErrors };
}

function fmt(counters: ImportCounters): string {
  return [
    `  brands: +${counters.brandsInserted} new, ${counters.brandsReused} reused`,
    `  items:  +${counters.itemsInserted} inserted, ~${counters.itemsUpdated} updated, =${counters.itemsUnchanged} unchanged, !${counters.itemsSkipped} skipped, x${counters.itemsDeactivated} deactivated`,
  ].join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(argv.slice(2));
  const creds = loadCreds(args.credsPath);

  const pool: Pool = mysql.createPool({
    host: creds.DB_HOST,
    user: creds.DB_USER,
    password: creds.DB_PASS,
    database: creds.DB_NAME,
    connectionLimit: 4,
    waitForConnections: true,
    charset: "utf8mb4",
    multipleStatements: false,
  });

  const conn = await pool.getConnection();
  let validationErrorCount = 0;
  try {
    await conn.beginTransaction();

    if (args.pedals !== null) {
      const rows = readCatalog(args.pedals);
      console.log(`[pedals]  source: ${args.pedals}  rows: ${rows.length}`);
      const res = await processKind(conn, "pedal", rows);
      if (args.deactivateMissing) {
        await deactivateMissing(conn, "pedal", res.seenIds, res.counters);
      }
      console.log(fmt(res.counters));
      if (res.validationErrors.length > 0) {
        console.warn(`[pedals]  validation failures: ${res.validationErrors.length}`);
        for (const { index, row } of res.validationErrors.slice(0, 5)) {
          console.warn(`    #${index}: ${JSON.stringify(row)}`);
        }
        if (res.validationErrors.length > 5) {
          console.warn(`    ... and ${res.validationErrors.length - 5} more`);
        }
        validationErrorCount += res.validationErrors.length;
      }
    }

    if (args.boards !== null) {
      const rows = readCatalog(args.boards);
      console.log(`[boards]  source: ${args.boards}  rows: ${rows.length}`);
      const res = await processKind(conn, "board", rows);
      if (args.deactivateMissing) {
        await deactivateMissing(conn, "board", res.seenIds, res.counters);
      }
      console.log(fmt(res.counters));
      if (res.validationErrors.length > 0) {
        console.warn(`[boards]  validation failures: ${res.validationErrors.length}`);
        for (const { index, row } of res.validationErrors.slice(0, 5)) {
          console.warn(`    #${index}: ${JSON.stringify(row)}`);
        }
        if (res.validationErrors.length > 5) {
          console.warn(`    ... and ${res.validationErrors.length - 5} more`);
        }
        validationErrorCount += res.validationErrors.length;
      }
    }

    if (args.dryRun) {
      await conn.rollback();
      console.log("[dry-run] transaction rolled back — no changes persisted");
    } else {
      await conn.commit();
      console.log("[commit] transaction committed");
    }
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }

  if (args.strict && validationErrorCount > 0) {
    console.error(`--strict: ${validationErrorCount} validation failure(s)`);
    exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
