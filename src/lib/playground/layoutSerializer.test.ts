import assert from "node:assert/strict";
import test from "node:test";
import { serializeLayout, parseSnapshot, type Layout } from "./layoutSerializer";

const sample: Layout = {
  title: "메인 보드",
  board: { kind: "catalog", id: 17, brand: "Pedaltrain", name: "Nano",
           width_in: 14.0, height_in: 3.0, image_filename: "pedaltrain-nano.png" },
  items: [
    { kind: "catalog", id: 1234, x: 0.25, y: 0.25, rot: 0, z: 0,
      brand: "Boss", name: "DS-1", width_in: 2.87, height_in: 4.72,
      image_filename: "boss-ds-1.png" },
  ],
};

test("serializeLayout produces v:1 JSON with the right shape", () => {
  const json = serializeLayout(sample);
  const parsed = JSON.parse(json);
  assert.equal(parsed.v, 1);
  assert.equal(parsed.title, "메인 보드");
  assert.equal(parsed.board.name, "Nano");
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].name, "DS-1");
});

test("parseSnapshot round-trips serializeLayout", () => {
  const round = parseSnapshot(serializeLayout(sample));
  assert.deepEqual(round, sample);
});

test("parseSnapshot rejects wrong version", () => {
  assert.throws(() => parseSnapshot('{"v":2,"title":"x","board":{},"items":[]}'));
});

test("parseSnapshot rejects malformed JSON", () => {
  assert.throws(() => parseSnapshot("not json"));
});
