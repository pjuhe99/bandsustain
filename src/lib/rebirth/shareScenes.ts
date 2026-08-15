import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

type SceneRow = RowDataPacket & { scene: string };

export async function getSharedScene(seed: string) {
  const [rows] = await getPool().query<SceneRow[]>(
    "SELECT scene FROM rebirth_share_scenes WHERE seed = ? LIMIT 1",
    [seed],
  );
  return rows[0]?.scene ?? null;
}

export async function saveFirstSharedScene(seed: string, scene: string) {
  await getPool().query(
    "INSERT IGNORE INTO rebirth_share_scenes (seed, scene) VALUES (?, ?)",
    [seed, scene],
  );
}
