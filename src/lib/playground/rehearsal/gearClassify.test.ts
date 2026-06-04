import assert from "node:assert/strict";
import test from "node:test";
import { classifyGear, classifyGearList } from "./gearClassify";

test("classifyGear: 매핑된 장비는 해당 타입", () => {
  assert.equal(classifyGear("Ampeg SVT810E"), "BASS_AMP");
  assert.equal(classifyGear("Pearl Masters"), "DRUM");
  assert.equal(classifyGear("Marshall JCM2000 DSL"), "GUITAR_AMP");
  assert.equal(classifyGear("YAMAHA MOTIF7"), "KEYBOARD");
});

test("classifyGear: 미매핑은 ETC", () => {
  assert.equal(classifyGear("듣도보도못한장비9999"), "ETC");
});

test("classifyGearList: 콤마 문자열 → RoomGear[] (트림·빈값 제거)", () => {
  const r = classifyGearList("Pearl Masters, Ampeg SVT810E ,, ");
  assert.deepEqual(r, [
    { name: "Pearl Masters", type: "DRUM" },
    { name: "Ampeg SVT810E", type: "BASS_AMP" },
  ]);
});
