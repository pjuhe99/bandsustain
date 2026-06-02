import type { Studio, RouteResult, EquipmentType, GeoPoint } from "./types";
import { haversineMeters } from "./geo";
import { scoreStudioForGroup, type StudioScore } from "./scoring";
import { generateRecommendationReason } from "./reason";
import { FINAL_LIMIT } from "./config";

export type RecommendConditions = {
  memberCount: number;
  maxBudgetPerHour: number | null;
  requiredEquipment: EquipmentType[];
  preferredRegionIds: number[];
};

export type RankedStudio = {
  rankNo: number;
  studio: Studio;
  score: StudioScore;
  reason: string;
};

function studioEquipmentTypes(s: Studio): EquipmentType[] {
  return s.equipment.map((e) => e.equipmentType);
}

export function filterStudiosByConditions(studios: Studio[], cond: RecommendConditions): Studio[] {
  return studios.filter((s) => {
    if (s.maxCapacity != null && s.maxCapacity < cond.memberCount) return false;
    if (cond.maxBudgetPerHour != null && s.hourlyPriceMin != null && s.hourlyPriceMin > cond.maxBudgetPerHour) return false;
    if (cond.requiredEquipment.length > 0) {
      const have = new Set(studioEquipmentTypes(s));
      if (!cond.requiredEquipment.every((e) => have.has(e))) return false;
    }
    if (cond.preferredRegionIds.length > 0) {
      if (s.regionId == null || !cond.preferredRegionIds.includes(s.regionId)) return false;
    }
    return true;
  });
}

export function prefilterByCentroid(studios: Studio[], center: GeoPoint, limit: number): Studio[] {
  return [...studios]
    .map((s) => ({ s, d: haversineMeters(center, { lat: s.lat, lng: s.lng }) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.s);
}

export function rankStudios(args: {
  studios: Studio[];
  routesByStudioId: Map<number, RouteResult[]>;
  conditions: RecommendConditions;
  limit?: number;
}): RankedStudio[] {
  const scored = args.studios
    .map((studio) => {
      const routes = args.routesByStudioId.get(studio.id);
      if (!routes || routes.length === 0) return null;
      const score = scoreStudioForGroup({
        routes,
        memberCount: args.conditions.memberCount,
        hourlyPriceMin: studio.hourlyPriceMin,
        maxCapacity: studio.maxCapacity,
        studioEquipmentTypes: studioEquipmentTypes(studio),
        requiredEquipment: args.conditions.requiredEquipment,
        maxBudgetPerHour: args.conditions.maxBudgetPerHour,
      });
      return { studio, score };
    })
    .filter((x): x is { studio: Studio; score: StudioScore } => x !== null)
    .sort((a, b) => a.score.score - b.score.score)
    .slice(0, args.limit ?? FINAL_LIMIT);

  return scored.map(({ studio, score }, i) => ({
    rankNo: i + 1,
    studio,
    score,
    reason: generateRecommendationReason({
      studioName: studio.name,
      score,
      hasAllEquipment: score.missingEquipment.length === 0,
      hourlyPriceMin: studio.hourlyPriceMin,
    }),
  }));
}
