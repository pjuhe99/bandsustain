import assert from "node:assert/strict";
import test from "node:test";
import { roomEquipmentTypes } from "./types";

test("roomEquipmentTypes: 방들의 타입 합집합, 정의 순서 유지", () => {
  const rooms = [
    { equipment: [{ name: "x", type: "KEYBOARD" as const }, { name: "y", type: "DRUM" as const }] },
    { equipment: [{ name: "z", type: "GUITAR_AMP" as const }] },
  ];
  assert.deepEqual(roomEquipmentTypes(rooms), ["DRUM", "GUITAR_AMP", "KEYBOARD"]);
});

test("roomEquipmentTypes: 빈 입력 → []", () => {
  assert.deepEqual(roomEquipmentTypes([]), []);
});
