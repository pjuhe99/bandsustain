import assert from "node:assert/strict";
import test from "node:test";
import { parsePrice, parseHasParking, commonPrefix, buildStudios, type CsvRow } from "./studioImport";

test("parsePrice: ₩/콤마 제거 → int, 빈값 null", () => {
  assert.equal(parsePrice("₩15,000"), 15000);
  assert.equal(parsePrice("25000"), 25000);
  assert.equal(parsePrice(""), null);
});

test("parseHasParking: '주차 O' true, '주차 X' false", () => {
  assert.equal(parseHasParking("악기대여 O, 주차 O"), true);
  assert.equal(parseHasParking("악기대여 O, 주차 X"), false);
  assert.equal(parseHasParking(""), false);
});

test("commonPrefix: 방 이름들의 공통 접두사", () => {
  assert.equal(commonPrefix(["엠플사운드 A1 room", "엠플사운드 B1 room"]), "엠플사운드");
  assert.equal(commonPrefix(["뉴잭사운드"]), "뉴잭사운드");
});

test("buildStudios: 네이버링크 그룹핑 + 합주실/방 변환", () => {
  const rows: CsvRow[] = [
    { name: "엠플사운드 A1 room", price: "₩25,000", etc: "악기대여 O, 주차 O", naver: "https://naver.me/X", capacity: "10", booking: "사이트 예약", location: "서울, 역삼", gear: "Pearl Masters, Ampeg SVT810E", review: "좋음" },
    { name: "엠플사운드 B1 room", price: "₩23,000", etc: "악기대여 O, 주차 O", naver: "https://naver.me/X", capacity: "7", booking: "사이트 예약", location: "서울, 역삼", gear: "Marshall JCM2000 DSL", review: "" },
  ];
  const studios = buildStudios(rows);
  assert.equal(studios.length, 1);
  const s = studios[0];
  assert.equal(s.name, "엠플사운드");
  assert.equal(s.areaLabel, "서울, 역삼");
  assert.equal(s.hasParking, true);
  assert.equal(s.bookingMethod, "사이트 예약");
  assert.equal(s.mapUrl, "https://naver.me/X");
  assert.equal(s.priceMin, 23000);
  assert.equal(s.priceMax, 25000);
  assert.equal(s.rooms.length, 2);
  assert.deepEqual(s.rooms[0], {
    name: "A1 room", hourlyPrice: 25000, capacity: 10,
    equipment: [{ name: "Pearl Masters", type: "DRUM" }, { name: "Ampeg SVT810E", type: "BASS_AMP" }],
    review: "좋음", sortOrder: 0,
  });
  assert.equal(s.rooms[1].name, "B1 room");
});
