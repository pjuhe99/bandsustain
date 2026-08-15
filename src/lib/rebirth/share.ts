import "server-only";
import rawData from "../../../public/playground/rebirth/rebirth-data-v1.json";
import { decodeRebirthSeed, restoreRebirth, type RebirthResult } from "./engine";
import type { RebirthData } from "./types";

const data = rawData as RebirthData;

export function sharedRebirthResult(seed: string): RebirthResult | null {
  const decoded = decodeRebirthSeed(seed);
  return decoded ? restoreRebirth(data, decoded) : null;
}
