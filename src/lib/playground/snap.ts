export const SNAP_STEP_INCHES = 0.25;

/**
 * Rounds to the nearest 0.25". JS `Math.round` rounds half toward +∞ so
 * exact ±0.125, ±0.375… land on the positive side. The asymmetry is
 * invisible at integer-pixel drag granularity and identical on client and server.
 */
export function snapTo025(value: number): number {
  return Math.round(value / SNAP_STEP_INCHES) * SNAP_STEP_INCHES;
}
