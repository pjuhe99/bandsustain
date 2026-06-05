import assert from "node:assert/strict";
import test from "node:test";
import { areaLabelFromAddress, normalizeName, transformNaverItems, type NaverItem } from "./naverImport";

function item(over: Partial<NaverItem>): NaverItem {
  return {
    id: "100", name: "테스트합주실", full_address: "서울특별시 종로구 대학로8가길 66", common_address: "서울 종로구 동숭동",
    phone: "", virtual_phone: "", booking_url: "", naver_map_url: "https://map.naver.com/p/entry/place/100",
    x: "127.0032507", y: "37.5829708", ...over,
  };
}

test("areaLabelFromAddress: 동/가 추출 + 폴백", () => {
  assert.equal(areaLabelFromAddress("서울 종로구 동숭동", ""), "서울, 동숭동");
  assert.equal(areaLabelFromAddress("서울 종로구 명륜2가 8-30 지하1층", ""), "서울, 명륜2가");
  assert.equal(areaLabelFromAddress("서울 종로구 8-30", ""), "서울, 종로구"); // 동 토큰 아님 → 구 폴백
  assert.equal(areaLabelFromAddress("", "서울특별시 중구 다산로14길 23"), "서울, 중구"); // common 없음 → full + 특별시 제거
});

test("normalizeName: 공백·'합주실' 제거", () => {
  assert.equal(normalizeName("엠플사운드합주실"), "엠플사운드");
  assert.equal(normalizeName("그루브합주실 방배점"), "그루브방배점");
});

test("중복: 좌표 25m 이내 skip / 이름 포함 skip / 38m 다른지점 유지", () => {
  const existing = [
    { name: "엠플사운드", lat: 37.51, lng: 127.04 },
    { name: "비쥬합주실 1호점", lat: 37.5, lng: 126.98 },
  ];
  const dupName = item({ id: "1", name: "엠플사운드합주실", y: "37.6", x: "127.1" });        // 이름 포함
  const dupCoord = item({ id: "2", name: "전혀다른이름", y: "37.51", x: "127.04" });          // 좌표 0m
  const nearBranch = item({ id: "3", name: "비쥬 합주실 2호점", y: "37.50034", x: "126.98" }); // ~38m + 이름 비포함 → 유지
  const r = transformNaverItems([dupName, dupCoord, nearBranch], existing);
  assert.deepEqual(r.skipped.map((s) => s.name).sort(), ["엠플사운드합주실", "전혀다른이름"]);
  assert.equal(r.studios.length, 1);
  assert.equal(r.studios[0].name, "비쥬 합주실 2호점");
});

test("JSON 내부 중복도 skip (먼저 수락된 것 기준)", () => {
  const a = item({ id: "1", name: "같은곳", y: "37.5", x: "127.0" });
  const b = item({ id: "2", name: "같은곳2호", y: "37.50001", x: "127.0" }); // ~1m
  const r = transformNaverItems([a, b], []);
  assert.equal(r.studios.length, 1);
  assert.equal(r.skipped.length, 1);
});

test("변환 필드: slug/phone 폴백/bookingMethod/가격 없음", () => {
  const withBook = item({ id: "55", booking_url: "https://booking", phone: "02-1", virtual_phone: "" });
  const phoneOnly = item({ id: "56", name: "둘", booking_url: "", phone: "", virtual_phone: "0507-1", y: "37.0", x: "127.5" });
  const none = item({ id: "57", name: "셋", booking_url: "", phone: "", virtual_phone: "", y: "36.0", x: "127.9" });
  const r = transformNaverItems([withBook, phoneOnly, none], []);
  assert.equal(r.studios[0].slug, "naver-55");
  assert.equal(r.studios[0].bookingMethod, "네이버 예약");
  assert.equal(r.studios[1].phone, "0507-1");
  assert.equal(r.studios[1].bookingMethod, "전화");
  assert.equal(r.studios[2].phone, null);
  assert.equal(r.studios[2].bookingMethod, null);
  assert.equal(r.studios[0].lat, 37.5829708);
  assert.equal(r.studios[0].roadAddress, "서울특별시 종로구 대학로8가길 66");
});
