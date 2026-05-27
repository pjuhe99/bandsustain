import assert from "node:assert/strict";
import test from "node:test";
import {
  DIMENSIONS,
  GENRES,
  QUESTIONS,
  TRACKS,
  type SoundVector,
} from "./data";
import {
  calculateUserProfile,
  createTestResult,
  getDistance,
  getProfileTags,
  getRecommendedTracks,
  rankGenres,
} from "./engine";

// 동일한 선택지 suffix(_a/_b/_c/_d)를 16문항 모두에 적용했을 때의 프로필을 만든다.
function profileForSuffix(suffix: string): SoundVector {
  const vectors = QUESTIONS.map((q) => {
    const option = q.options.find((o) => o.id.endsWith(suffix));
    assert.ok(option, `문항 ${q.id} 에 ${suffix} 선택지가 없습니다`);
    return option!.vector;
  });
  return calculateUserProfile(vectors);
}

test("문항은 정확히 16개이고 모두 4지선다이며 고유 id 를 가진다", () => {
  assert.equal(QUESTIONS.length, 16);
  const ids = new Set<string>();
  for (const q of QUESTIONS) {
    assert.equal(q.options.length, 4, `${q.id} 선택지 4개 아님`);
    for (const o of q.options) {
      assert.ok(!ids.has(o.id), `중복 option id: ${o.id}`);
      ids.add(o.id);
    }
  }
});

test("모든 option/genre/track 벡터는 8개 차원을 가지며 값이 0~5 범위다", () => {
  const all: SoundVector[] = [
    ...QUESTIONS.flatMap((q) => q.options.map((o) => o.vector)),
    ...GENRES.map((g) => g.vector),
    ...TRACKS.map((t) => t.vector),
  ];
  for (const v of all) {
    for (const d of DIMENSIONS) {
      assert.equal(typeof v[d], "number", `차원 ${d} 누락`);
      assert.ok(v[d] >= 0 && v[d] <= 5, `차원 ${d} 값 범위 밖: ${v[d]}`);
    }
  }
});

test("track id 와 genreId 참조 무결성", () => {
  const trackIds = new Set<string>();
  const genreIds = new Set(GENRES.map((g) => g.id));
  for (const t of TRACKS) {
    assert.ok(!trackIds.has(t.id), `중복 track id: ${t.id}`);
    trackIds.add(t.id);
    assert.ok(t.genreIds.length > 0, `${t.id} genreIds 비어있음`);
    for (const gid of t.genreIds) {
      assert.ok(genreIds.has(gid), `${t.id} 가 존재하지 않는 장르 참조: ${gid}`);
    }
  }
});

test("곡 카탈로그는 100곡 이상이며 각 장르가 충분히 두껍다", () => {
  assert.ok(TRACKS.length >= 100, `곡 수 부족: ${TRACKS.length}`);
  for (const g of GENRES) {
    const count = TRACKS.filter((t) => t.genreIds.includes(g.id)).length;
    assert.ok(count >= 8, `${g.id} 장르 곡이 8곡 미만 (${count})`);
  }
});

test("calculateUserProfile 은 차원별 평균을 반환한다", () => {
  const v1: SoundVector = {
    energy: 4, brightness: 2, distortion: 0, groove: 4,
    atmosphere: 2, complexity: 0, emotion: 4, accessibility: 2,
  };
  const v2: SoundVector = {
    energy: 2, brightness: 4, distortion: 2, groove: 0,
    atmosphere: 4, complexity: 2, emotion: 0, accessibility: 4,
  };
  const p = calculateUserProfile([v1, v2]);
  assert.equal(p.energy, 3);
  assert.equal(p.brightness, 3);
  assert.equal(p.groove, 2);
  assert.equal(p.emotion, 2);
});

test("getDistance 는 동일 벡터에 0, 대칭이다", () => {
  const a = GENRES[0].vector;
  const b = GENRES[3].vector;
  assert.equal(getDistance(a, a), 0);
  assert.ok(Math.abs(getDistance(a, b) - getDistance(b, a)) < 1e-9);
});

test("getRecommendedTracks 는 같은 아티스트 중복 없이 limit 만큼 반환한다", () => {
  const profile = profileForSuffix("_c");
  const tracks = getRecommendedTracks(profile, ["metalcore", "alternative-rock"], 3);
  assert.equal(tracks.length, 3);
  const artists = tracks.map((t) => t.artist);
  assert.equal(new Set(artists).size, artists.length, "아티스트 중복");
});

test("createTestResult 는 메인1/서브2/추천3/거리1/체험2 를 항상 채운다", () => {
  for (const suffix of ["_a", "_b", "_c", "_d"]) {
    const result = createTestResult(profileForSuffix(suffix));
    assert.ok(result.mainGenre, `${suffix} mainGenre 없음`);
    assert.equal(result.subGenres.length, 2, `${suffix} 서브장르 2개 아님`);
    assert.equal(result.recommendedTracks.length, 3, `${suffix} 추천곡 3곡 아님`);
    assert.ok(result.distantGenre, `${suffix} 거리장르 없음`);
    assert.equal(result.discoveryTracks.length, 2, `${suffix} 체험곡 2곡 아님`);

    // 메인/서브/거리 장르는 서로 다르다
    const genreIds = [
      result.mainGenre.id,
      ...result.subGenres.map((g) => g.id),
      result.distantGenre.id,
    ];
    assert.equal(new Set(genreIds).size, genreIds.length, `${suffix} 장르 중복`);

    // 추천곡 아티스트 중복 없음
    const artists = result.recommendedTracks.map((t) => t.artist);
    assert.equal(new Set(artists).size, artists.length, `${suffix} 추천곡 아티스트 중복`);

    // 태그는 최대 3개
    assert.ok(result.tags.length <= 3 && result.tags.length > 0, `${suffix} 태그 개수 이상`);
  }
});

test("거리 장르(distantGenre)는 프로필에서 가장 먼 장르다", () => {
  const profile = profileForSuffix("_c");
  const ranked = rankGenres(profile);
  const result = createTestResult(profile);
  assert.equal(result.distantGenre.id, ranked[ranked.length - 1].genre.id);
});

// 스펙 §8 결과 검증용 픽스처: 특정 suffix 를 일관 선택하면 대략 해당 장르군이 나와야 한다.
test("§8 픽스처: 일관된 선택은 의도한 장르군 근처로 수렴한다", () => {
  const fixtures: { suffix: string; expectedNear: string[] }[] = [
    { suffix: "_b", expectedNear: ["jpop-band", "citypop-funkpop", "pop-punk"] },
    { suffix: "_c", expectedNear: ["metalcore", "alternative-rock"] },
    { suffix: "_d", expectedNear: ["shoegaze-dreampop", "math-progressive"] },
  ];
  for (const { suffix, expectedNear } of fixtures) {
    const result = createTestResult(profileForSuffix(suffix));
    assert.ok(
      expectedNear.includes(result.mainGenre.id),
      `${suffix} 메인 장르가 기대 밖: ${result.mainGenre.id} (기대 ${expectedNear.join("/")})`,
    );
  }
});

test("getProfileTags 는 후보가 없어도 fallbackTags 로 3개를 채운다", () => {
  const flat: SoundVector = {
    energy: 3, brightness: 3, distortion: 3, groove: 3,
    atmosphere: 3, complexity: 3, emotion: 3, accessibility: 3,
  };
  const tags = getProfileTags(flat, GENRES[0]);
  assert.equal(tags.length, 3);
  assert.equal(new Set(tags).size, 3, "태그 중복");
});
