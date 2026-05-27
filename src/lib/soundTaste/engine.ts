// 사운드 취향 테스트 추천 엔진.
// 선택한 option vector 들의 차원별 평균으로 사용자 프로필을 만들고,
// "평균 대비 어느 축으로 기울었는가(방향)" 를 코사인 유사도로 매칭한다.
//
// 왜 거리(Euclidean)가 아니라 코사인인가: 16개 답을 평균내면 프로필이 중앙으로
// 회귀(중심극한정리)해서, 극단에 박힌 장르 앵커(메탈코어/팝펑크)는 혼합 응답으로는
// 도달 불가하고 중앙의 얼터록만 독식한다. 코사인은 절대 위치가 아니라 방향을 보므로
// 살짝 무겁게 답한 사람도 그 방향의 장르를 받을 수 있어 분포가 고르게 펴진다.
// 각 축은 옵션 분포의 표준편차로 표준화(축마다 영향이 균형) + DIMENSION_WEIGHTS 가중.

import {
  DIMENSIONS,
  DIMENSION_WEIGHTS,
  GENRES,
  PROFILE_TAG_RULES,
  QUESTIONS,
  TRACKS,
  type Genre,
  type SoundVector,
  type Track,
} from "./data";

export interface TestResult {
  profile: SoundVector;
  mainGenre: Genre;
  subGenres: Genre[];
  distantGenre: Genre;
  tags: string[];
  recommendedTracks: Track[];
  discoveryTracks: Track[];
}

// 모든 선택지 벡터로부터 축별 평균(중심)과 표준편차(스케일)를 1회 산출 (정적 데이터).
const ALL_OPTION_VECTORS: SoundVector[] = QUESTIONS.flatMap((q) =>
  q.options.map((o) => o.vector),
);

const CENTER: SoundVector = (() => {
  const c = createEmptyVector();
  for (const d of DIMENSIONS) {
    c[d] = ALL_OPTION_VECTORS.reduce((s, v) => s + v[d], 0) / ALL_OPTION_VECTORS.length;
  }
  return c;
})();

const AXIS_SD: SoundVector = (() => {
  const sd = createEmptyVector();
  for (const d of DIMENSIONS) {
    const variance =
      ALL_OPTION_VECTORS.reduce((s, v) => s + (v[d] - CENTER[d]) ** 2, 0) /
      ALL_OPTION_VECTORS.length;
    sd[d] = Math.sqrt(variance) || 1; // 분산 0 인 축은 1 로 (0 나눗셈 방지)
  }
  return sd;
})();

export function createEmptyVector(): SoundVector {
  return {
    energy: 0,
    brightness: 0,
    distortion: 0,
    groove: 0,
    atmosphere: 0,
    complexity: 0,
    emotion: 0,
    accessibility: 0,
  };
}

export function calculateUserProfile(vectors: SoundVector[]): SoundVector {
  if (vectors.length === 0) return createEmptyVector();

  const total = vectors.reduce((acc, vector) => {
    DIMENSIONS.forEach((dimension) => {
      acc[dimension] += vector[dimension];
    });
    return acc;
  }, createEmptyVector());

  return DIMENSIONS.reduce((profile, dimension) => {
    profile[dimension] = Number((total[dimension] / vectors.length).toFixed(2));
    return profile;
  }, createEmptyVector());
}

// 가중 유클리드 거리 — 직접 매칭엔 더 이상 쓰지 않지만, 두 사운드 좌표가
// 얼마나 떨어졌는지 보는 순수 유틸로 유지한다.
export function getDistance(a: SoundVector, b: SoundVector): number {
  return Math.sqrt(
    DIMENSIONS.reduce((sum, dimension) => {
      const diff = a[dimension] - b[dimension];
      return sum + DIMENSION_WEIGHTS[dimension] * diff * diff;
    }, 0),
  );
}

// 평균 대비 방향의 코사인 유사도 (-1 ~ 1). 축별 표준화 + 차원 가중.
export function getSimilarity(a: SoundVector, b: SoundVector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const d of DIMENSIONS) {
    const w = DIMENSION_WEIGHTS[d];
    const za = (a[d] - CENTER[d]) / AXIS_SD[d];
    const zb = (b[d] - CENTER[d]) / AXIS_SD[d];
    dot += w * za * zb;
    normA += w * za * za;
    normB += w * zb * zb;
  }
  const denom = Math.sqrt(normA * normB);
  return denom === 0 ? 0 : dot / denom;
}

// 유사도 내림차순 정렬 (가장 가까운 방향이 맨 앞, 가장 반대인 방향이 맨 뒤).
export function rankGenres(profile: SoundVector) {
  return GENRES.map((genre) => ({
    genre,
    score: getSimilarity(profile, genre.vector),
  })).sort((a, b) => b.score - a.score);
}

export function getRecommendedTracks(
  profile: SoundVector,
  genreIds: string[],
  limit = 3,
): Track[] {
  const candidates = TRACKS.filter((track) =>
    track.genreIds.some((genreId) => genreIds.includes(genreId)),
  ).sort((a, b) => getSimilarity(profile, b.vector) - getSimilarity(profile, a.vector));

  const result: Track[] = [];
  const usedArtists = new Set<string>();

  for (const track of candidates) {
    if (usedArtists.has(track.artist)) continue;
    result.push(track);
    usedArtists.add(track.artist);
    if (result.length >= limit) break;
  }

  return result;
}

export function getProfileTags(profile: SoundVector, mainGenre: Genre): string[] {
  const candidates = PROFILE_TAG_RULES.filter((rule) => rule.test(profile)).map(
    (rule) => rule.label,
  );

  const ordered = [
    ...mainGenre.preferredTagOrder.filter((tag) => candidates.includes(tag)),
    ...candidates.filter((tag) => !mainGenre.preferredTagOrder.includes(tag)),
    ...mainGenre.fallbackTags,
  ];

  return Array.from(new Set(ordered)).slice(0, 3);
}

export function createTestResult(profile: SoundVector): TestResult {
  const rankedGenres = rankGenres(profile);
  const mainGenre = rankedGenres[0].genre;
  const subGenres = rankedGenres.slice(1, 3).map((item) => item.genre);
  const distantGenre = rankedGenres[rankedGenres.length - 1].genre;

  const recommendedTracks = getRecommendedTracks(
    profile,
    [mainGenre.id, ...subGenres.map((genre) => genre.id)],
    3,
  );

  // 반대편(거리) 장르의 곡 중에서도 사용자와 방향이 가장 덜 어긋나는(가장 유사한)
  // 2곡 = 입문하기 덜 부담스러운 곡.
  const discoveryTracks = getRecommendedTracks(profile, [distantGenre.id], 2);

  return {
    profile,
    mainGenre,
    subGenres,
    distantGenre,
    tags: getProfileTags(profile, mainGenre),
    recommendedTracks,
    discoveryTracks,
  };
}
