export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = (typeof ROTATIONS)[number];

/**
 * Advances to the next 90° step clockwise.
 * If `current` is not a valid Rotation, `indexOf` returns -1 and the result
 * wraps to ROTATIONS[0] (0°). Callers should gate untrusted input with
 * `isValidRotation` first.
 */
export function rotateRight(current: number): Rotation {
  const i = ROTATIONS.indexOf(current as Rotation);
  return ROTATIONS[(i + 1) % ROTATIONS.length];
}

/**
 * Steps counter-clockwise to the previous 90° rotation.
 * If `current` is not a valid Rotation, the result wraps to ROTATIONS[3] (270°).
 * Callers should gate untrusted input with `isValidRotation` first.
 */
export function rotateLeft(current: number): Rotation {
  const i = ROTATIONS.indexOf(current as Rotation);
  return ROTATIONS[(i - 1 + ROTATIONS.length) % ROTATIONS.length];
}

export function isValidRotation(value: number): value is Rotation {
  return (ROTATIONS as readonly number[]).includes(value);
}
