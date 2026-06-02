// 추천 점수식 튜닝 지점. 모든 값 "낮을수록 좋음" 점수에 더해지는 분(minute)-환산.
export const PREFILTER_LIMIT = 15;   // 중심점 직선거리 상위 N개만 경로계산
export const FINAL_LIMIT = 5;        // 최종 추천 노출 개수

export const SCORING_WEIGHTS = {
  spread: 0.7,     // (max - avg) 이동시간 편차 가중
  transfer: 4,     // 평균 환승 1회당 분-환산
  walking: 0.15,   // 평균 도보 1분당 가중
} as const;

export const PRICE_PENALTY_PER_1000_OVER = 2; // 예산 초과 1000원당 분-환산
export const CAPACITY_PENALTY = 30;           // 수용인원 미달 시 고정 페널티
export const MISSING_EQUIPMENT_PENALTY = 50;  // 필수장비 1종 누락당 페널티

export const ROUTE_CACHE_TTL_HOURS = 24 * 7;  // 경로 캐시 7일
export const COORD_ROUNDING_DECIMALS = 3;     // 캐시 키 좌표 반올림(~110m 그리드)
