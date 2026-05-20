import { z } from "zod";

const BoardSchema = z.object({
  kind: z.literal("catalog"),
  id: z.number().int().positive(),
  brand: z.string(),
  name: z.string(),
  width_in: z.number(),
  height_in: z.number(),
  image_filename: z.string().nullable(),
});

const ItemSchema = z.object({
  kind: z.literal("catalog"),
  id: z.number().int().positive(),
  x: z.number(),
  y: z.number(),
  rot: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  z: z.number().int(),
  brand: z.string(),
  name: z.string(),
  width_in: z.number(),
  height_in: z.number(),
  image_filename: z.string().nullable(),
});

const SnapshotSchema = z.object({
  v: z.literal(1),
  title: z.string(),
  board: BoardSchema,
  items: z.array(ItemSchema),
});

const LayoutSchema = SnapshotSchema.omit({ v: true });
export type Layout = z.infer<typeof LayoutSchema>;
export type LayoutItem = z.infer<typeof ItemSchema>;
export type LayoutBoard = z.infer<typeof BoardSchema>;

export function serializeLayout(layout: Layout): string {
  return JSON.stringify({ v: 1, ...layout });
}

export function parseSnapshot(json: string): Layout {
  const parsed = SnapshotSchema.parse(JSON.parse(json));
  const { v: _v, ...rest } = parsed;
  return rest;
}
