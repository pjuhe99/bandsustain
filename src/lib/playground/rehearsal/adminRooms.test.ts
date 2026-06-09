import assert from "node:assert/strict";
import test from "node:test";
import { parseRoomRows, deriveStudioStats, gearToText, type RoomRowInput } from "./adminRooms";

test("parseRoomRows: 텍스트 행 → RoomWrite (장비 자동분류, 빈 이름 행 skip)", () => {
  const rows: RoomRowInput[] = [
    { name: "A룸", price: "20000", capacity: "8", gear: "DW 드럼, 마샬 기타앰프", review: "좋음" },
    { name: "", price: "1", capacity: "1", gear: "", review: "" },           // 이름 없음 → skip
    { name: "B룸", price: "", capacity: "", gear: "", review: "" },          // 가격/인원 미상 허용
  ];
  const out = parseRoomRows(rows);
  assert.equal(out.length, 2);
  assert.equal(out[0].name, "A룸");
  assert.equal(out[0].hourlyPrice, 20000);
  assert.equal(out[0].capacity, 8);
  assert.equal(out[0].equipment.length, 2);
  assert.equal(out[0].equipment[0].name, "DW 드럼");
  assert.equal(out[0].review, "좋음");
  assert.equal(out[0].sortOrder, 0);
  assert.equal(out[1].hourlyPrice, null);
  assert.equal(out[1].capacity, null);
  assert.deepEqual(out[1].equipment, []);
  assert.equal(out[1].review, null);
  assert.equal(out[1].sortOrder, 1);
});

test("deriveStudioStats: 방 가격 min/max(null 제외)·인원 max, 전부 null 이면 null", () => {
  assert.deepEqual(
    deriveStudioStats([
      { hourlyPrice: 20000, capacity: 8 }, { hourlyPrice: 15000, capacity: null }, { hourlyPrice: null, capacity: 12 },
    ]),
    { priceMin: 15000, priceMax: 20000, capacityMax: 12 },
  );
  assert.deepEqual(deriveStudioStats([{ hourlyPrice: null, capacity: null }]), { priceMin: null, priceMax: null, capacityMax: null });
  assert.deepEqual(deriveStudioStats([]), { priceMin: null, priceMax: null, capacityMax: null });
});

test("gearToText: equipment → 쉼표 텍스트 라운드트립", () => {
  assert.equal(gearToText([{ name: "DW 드럼", type: "DRUM" }, { name: "마샬", type: "GUITAR_AMP" }]), "DW 드럼, 마샬");
  assert.equal(gearToText([]), "");
});
