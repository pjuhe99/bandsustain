import assert from "node:assert/strict";
import test from "node:test";
import { serializeLayout, type Layout } from "./layoutSerializer";
import { toThumbnail } from "./thumbnail";

const sample: Layout = {
  title: "메인 보드",
  board: { kind: "catalog", id: 17, brand: "Pedaltrain", name: "Nano",
           width_in: 14.0, height_in: 3.0, image_filename: "pedaltrain-nano.png" },
  items: [
    { kind: "catalog", id: 1234, x: 0.25, y: 0.5, rot: 90, z: 0,
      brand: "Boss", name: "DS-1", width_in: 2.87, height_in: 4.72,
      image_filename: "boss-ds-1.png" },
  ],
};

test("toThumbnail derives board dims + items from a valid snapshot", () => {
  const thumb = toThumbnail(serializeLayout(sample));
  assert.ok(thumb);
  assert.deepEqual(thumb.board, { width_in: 14, height_in: 3, image_filename: "pedaltrain-nano.png" });
  assert.equal(thumb.items.length, 1);
  assert.deepEqual(thumb.items[0], {
    x: 0.25, y: 0.5, rot: 90, width_in: 2.87, height_in: 4.72, image_filename: "boss-ds-1.png",
  });
});

test("toThumbnail keeps an empty items array (board with no pedals)", () => {
  const thumb = toThumbnail(serializeLayout({ ...sample, items: [] }));
  assert.ok(thumb);
  assert.deepEqual(thumb.items, []);
});

test("toThumbnail returns null for null/empty input (fallback path)", () => {
  assert.equal(toThumbnail(null), null);
  assert.equal(toThumbnail(undefined), null);
  assert.equal(toThumbnail(""), null);
});

test("toThumbnail returns null for malformed JSON (never throws)", () => {
  assert.equal(toThumbnail("not json"), null);
  assert.equal(toThumbnail('{"v":2,"title":"x","board":{},"items":[]}'), null);
});

test("toThumbnail returns null when board dimensions are non-positive", () => {
  const bad = JSON.parse(serializeLayout(sample));
  bad.board.width_in = 0;
  assert.equal(toThumbnail(JSON.stringify(bad)), null);
});
