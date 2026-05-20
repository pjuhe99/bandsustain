export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = (typeof ROTATIONS)[number];

export function rotateRight(current: number): Rotation {
  const i = ROTATIONS.indexOf(current as Rotation);
  return ROTATIONS[(i + 1) % ROTATIONS.length];
}

export function rotateLeft(current: number): Rotation {
  const i = ROTATIONS.indexOf(current as Rotation);
  return ROTATIONS[(i - 1 + ROTATIONS.length) % ROTATIONS.length];
}

export function isValidRotation(value: number): value is Rotation {
  return (ROTATIONS as readonly number[]).includes(value);
}
