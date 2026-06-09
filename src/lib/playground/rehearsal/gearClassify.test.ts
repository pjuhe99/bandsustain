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

test("classifyGear: 일반 단어 키워드 폴백 (admin 수기 입력)", () => {
  assert.equal(classifyGear("드럼"), "DRUM");
  assert.equal(classifyGear("DW 드럼세트"), "DRUM");
  assert.equal(classifyGear("마샬 기타앰프"), "GUITAR_AMP");
  assert.equal(classifyGear("기타 앰프"), "GUITAR_AMP");
  assert.equal(classifyGear("베이스앰프"), "BASS_AMP");
  assert.equal(classifyGear("암페그 베이스"), "BASS_AMP");
  assert.equal(classifyGear("키보드"), "KEYBOARD");
  assert.equal(classifyGear("신디사이저"), "KEYBOARD");
  assert.equal(classifyGear("기타"), "ETC");        // '기타' 단독은 모호 → ETC
  assert.equal(classifyGear("마이크"), "ETC");
});
