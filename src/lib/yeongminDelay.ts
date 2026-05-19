export function remainingDelayMs(elapsedMs: number, minimumMs: number): number {
  return Math.max(0, minimumMs - elapsedMs);
}
