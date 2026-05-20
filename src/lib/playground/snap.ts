export const SNAP_STEP_IN = 0.25;

export function snapTo025(value: number): number {
  return Math.round(value / SNAP_STEP_IN) * SNAP_STEP_IN;
}
