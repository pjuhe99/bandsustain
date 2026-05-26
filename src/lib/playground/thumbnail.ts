import { parseSnapshot } from "./layoutSerializer";

export type ThumbItem = {
  x: number;
  y: number;
  rot: number;
  width_in: number;
  height_in: number;
  image_filename: string | null;
};

export type ThumbData = {
  board: { width_in: number; height_in: number; image_filename: string | null };
  items: ThumbItem[];
};

/**
 * Derive the minimal data needed to composite a gallery thumbnail — the board
 * image plus each pedal positioned over it — from a layout's snapshot_json.
 *
 * Never throws: returns null when the snapshot is missing, malformed, or has
 * non-positive board dimensions, so callers fall back to the bare board image
 * (the previous thumbnail behavior).
 */
export function toThumbnail(snapshotJson: string | null | undefined): ThumbData | null {
  if (!snapshotJson) return null;
  try {
    const layout = parseSnapshot(snapshotJson);
    const { width_in, height_in } = layout.board;
    if (!(width_in > 0) || !(height_in > 0)) return null;
    return {
      board: { width_in, height_in, image_filename: layout.board.image_filename },
      items: layout.items.map((it) => ({
        x: it.x,
        y: it.y,
        rot: it.rot,
        width_in: it.width_in,
        height_in: it.height_in,
        image_filename: it.image_filename,
      })),
    };
  } catch {
    return null;
  }
}
