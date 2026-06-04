import assert from "node:assert/strict";
import test from "node:test";
import {
  METRO_STATIONS, getStations, getLines, findStationById,
  stationLabel, searchStations, reconcileSelection,
} from "./metroStations";

test("데이터 로드: 수도권 역이 충분히 많다 (>550)", () => {
  assert.ok(METRO_STATIONS.length > 550, `got ${METRO_STATIONS.length}`);
});

test("모든 좌표가 한국 범위(위도 33~39, 경도 124~132) 안", () => {
  for (const s of METRO_STATIONS) {
    assert.ok(s.lat >= 33 && s.lat <= 39, `${s.id} lat ${s.lat}`);
    assert.ok(s.lng >= 124 && s.lng <= 132, `${s.id} lng ${s.lng}`);
  }
});

test("id 유니크 · lines 비어있지 않음", () => {
  const ids = METRO_STATIONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of METRO_STATIONS) assert.ok(s.lines.length > 0, `${s.id} has no lines`);
});

test("호선명 정규화: 흔들림 표기 잔존 0", () => {
  const bad = new Set(["경의중앙", "김포 골드라인", "신림역", "경의선", "분당선", "수인선", "인천선"]);
  for (const s of METRO_STATIONS) for (const l of s.lines) assert.ok(!bad.has(l), `bad line ${l} in ${s.id}`);
});

test("getLines: 24개 호선, LINE_ORDER 순서대로", () => {
  const lines = getLines();
  assert.equal(lines.length, 24, lines.join(","));
  assert.equal(lines[0], "1호선");
  assert.ok(lines.includes("수인분당선") && lines.includes("GTX-A"));
});

test("동명이역 양평: 2엔트리 · ambiguous true", () => {
  const yp = getStations().filter((s) => s.name === "양평");
  assert.equal(yp.length, 2, "양평 should have 2 entries");
  assert.ok(yp.every((s) => s.ambiguous), "both ambiguous");
});

test("findStationById: 매칭/미매칭", () => {
  const s = findStationById("강남");
  assert.ok(s, "강남 should exist");
  assert.deepEqual(s!.lines, ["2호선", "신분당선"]);
  assert.equal(findStationById("없는id12345"), null);
});

test("stationLabel: 일반역=name, 동명이역=name (area)", () => {
  assert.equal(stationLabel(findStationById("강남")!), "강남");
  const yp = getStations().find((s) => s.id === "양평#영등포구")!;
  assert.equal(stationLabel(yp), "양평 (영등포구)");
});

test("searchStations: 빈/공백 쿼리는 항상 [] (호선 선택과 무관)", () => {
  assert.deepEqual(searchStations("", []), []);
  assert.deepEqual(searchStations("   ", ["2호선"]), []);
});

test("searchStations: 한글 prefix 매칭 + prefix 우선 정렬", () => {
  const r = searchStations("강남", []);
  assert.ok(r.length > 0);
  assert.equal(r[0].name.startsWith("강남"), true);
  assert.ok(r.some((s) => s.id === "강남"));
});

test("searchStations: 호선 필터 교집합", () => {
  const r = searchStations("강", ["신분당선"]);
  assert.ok(r.every((s) => s.lines.includes("신분당선")), "all on 신분당선");
  assert.ok(r.some((s) => s.name === "강남"), "강남 is on 신분당선");
});

test("searchStations: 결과 상한 50", () => {
  assert.ok(searchStations("역", []).length <= 50);
});

test("reconcileSelection: 라벨 일치 유지 / 불일치 시 null", () => {
  assert.equal(reconcileSelection("강남", "강남"), "강남");
  assert.equal(reconcileSelection("강남", "강남구청"), null);
  assert.equal(reconcileSelection(null, "강남"), null);
  assert.equal(reconcileSelection("강남", ""), null);
  // 동명이역: 라벨(괄호 포함)이 정확히 일치해야 유지
  assert.equal(reconcileSelection("양평#영등포구", "양평 (영등포구)"), "양평#영등포구");
  assert.equal(reconcileSelection("양평#영등포구", "양평"), null);
});
