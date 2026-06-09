import type { RouteResult, EquipmentType } from "./types";
import {
  SCORING_WEIGHTS, CAPACITY_PENALTY, MISSING_EQUIPMENT_PENALTY,
  PRICE_PENALTY_PER_1000_OVER,
} from "./config";

export type StudioScoreInput = {
  routes: RouteResult[]; // 멤버 1인당 1개
  memberCount: number;
  hourlyPriceMin: number | null;
  maxCapacity: number | null;
  studioEquipmentTypes: EquipmentType[];
  requiredEquipment: EquipmentType[];
  maxBudgetPerHour: number | null;
};

export type StudioScore = {
  score: number; // 낮을수록 좋음
  avgMinutes: number;
  maxMinutes: number;
  minMinutes: number;
  spreadMinutes: number;
  avgTransfer: number;
  avgWalking: number;
  pricePenalty: number;
  capacityPenalty: number;
  equipmentPenalty: number;
  fairnessScore: number;
  missingEquipment: EquipmentType[];
};

function mean(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function scoreStudioForGroup(input: StudioScoreInput): StudioScore {
  if (input.routes.length === 0) throw new Error("scoreStudioForGroup: empty routes");

  const minutes = input.routes.map((r) => r.travelMinutes);
  const avgMinutes = mean(minutes);
  const maxMinutes = Math.max(...minutes);
  const minMinutes = Math.min(...minutes);
  const spreadMinutes = maxMinutes - avgMinutes;
  const avgTransfer = mean(input.routes.map((r) => r.transferCount));
  const avgWalking = mean(input.routes.map((r) => r.walkingMinutes));

  let pricePenalty = 0;
  if (
    input.maxBudgetPerHour != null &&
    input.hourlyPriceMin != null &&
    input.hourlyPriceMin > input.maxBudgetPerHour
  ) {
    pricePenalty =
      ((input.hourlyPriceMin - input.maxBudgetPerHour) / 1000) * PRICE_PENALTY_PER_1000_OVER;
  }

  let capacityPenalty = 0;
  if (input.maxCapacity != null && input.maxCapacity < input.memberCount) {
    capacityPenalty = CAPACITY_PENALTY;
  }

  const missingEquipment = input.requiredEquipment.filter(
    (e) => !input.studioEquipmentTypes.includes(e),
  );
  const equipmentPenalty = missingEquipment.length * MISSING_EQUIPMENT_PENALTY;

  const score =
    avgMinutes +
    SCORING_WEIGHTS.spread * spreadMinutes +
    SCORING_WEIGHTS.transfer * avgTransfer +
    SCORING_WEIGHTS.walking * avgWalking +
    pricePenalty +
    capacityPenalty +
    equipmentPenalty;

  return {
    score, avgMinutes, maxMinutes, minMinutes, spreadMinutes,
    avgTransfer, avgWalking, pricePenalty, capacityPenalty, equipmentPenalty,
    fairnessScore: spreadMinutes, missingEquipment,
  };
}
