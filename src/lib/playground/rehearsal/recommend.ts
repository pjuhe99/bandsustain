import "server-only";
import type { ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import type {
  RecommendInput, Studio, RouteResult, MemberRoute, TimeBucket, GeoPoint,
} from "./types";
import { centroid } from "./geo";
import { getCandidateStudios } from "./studios";
import { readRouteCache, writeRouteCache } from "./route-cache";
import { MockRouteProvider, type RouteProvider } from "./route-provider";
import { filterStudiosByConditions, prefilterByCentroid, rankStudios } from "./ranker";
import { timeBucketFor } from "./timeBucket";
import { PREFILTER_LIMIT, FINAL_LIMIT } from "./config";

export type RecommendResultItem = {
  rankNo: number;
  studio: Studio;
  score: number;
  avgMinutes: number;
  maxMinutes: number;
  minMinutes: number;
  spreadMinutes: number;
  avgTransfer: number;
  avgWalking: number;
  reason: string;
  memberRoutes: MemberRoute[];
};

export type RecommendOutput = {
  searchId: number;
  results: RecommendResultItem[];
};

export async function recommendStudios(
  input: RecommendInput,
  opts?: { routeProvider?: RouteProvider; now?: Date },
): Promise<RecommendOutput> {
  for (const m of input.members) {
    if (!Number.isFinite(m.originLat) || !Number.isFinite(m.originLng)) {
      throw new Error(`member "${m.nickname}" 좌표 없음`);
    }
  }
  if (input.members.length === 0) throw new Error("members 비어있음");

  const provider = opts?.routeProvider ?? new MockRouteProvider();
  const timeBucket: TimeBucket = timeBucketFor(opts?.now ?? new Date());
  const memberCount = input.members.length;

  const searchId = await insertSearch(input, memberCount);

  try {
    const candidates = await getCandidateStudios();
    const filtered = filterStudiosByConditions(candidates, {
      memberCount, maxBudgetPerHour: input.maxBudgetPerHour,
      requiredEquipment: input.requiredEquipment, preferredRegionIds: input.preferredRegionIds,
    });
    const center = centroid(input.members.map((m) => ({ lat: m.originLat, lng: m.originLng })));
    const prefiltered = prefilterByCentroid(filtered, center, PREFILTER_LIMIT);

    const routesByStudioId = new Map<number, RouteResult[]>();
    const memberRoutesByStudioId = new Map<number, MemberRoute[]>();
    for (const studio of prefiltered) {
      const routes: RouteResult[] = [];
      const memberRoutes: MemberRoute[] = [];
      for (const m of input.members) {
        const origin: GeoPoint = { lat: m.originLat, lng: m.originLng };
        const route = await getOrCalcRoute(origin, studio, input.transportMode, timeBucket, provider);
        routes.push(route);
        memberRoutes.push({ nickname: m.nickname, route });
      }
      routesByStudioId.set(studio.id, routes);
      memberRoutesByStudioId.set(studio.id, memberRoutes);
    }

    const ranked = rankStudios({
      studios: prefiltered, routesByStudioId,
      conditions: {
        memberCount, maxBudgetPerHour: input.maxBudgetPerHour,
        requiredEquipment: input.requiredEquipment, preferredRegionIds: input.preferredRegionIds,
      },
      limit: FINAL_LIMIT,
    });

    await persistResults(searchId, ranked);
    await getPool().query(`UPDATE playground_rehearsal_searches SET search_status='completed' WHERE id=?`, [searchId]);

    const results: RecommendResultItem[] = ranked.map((r) => ({
      rankNo: r.rankNo, studio: r.studio, score: r.score.score,
      avgMinutes: r.score.avgMinutes, maxMinutes: r.score.maxMinutes, minMinutes: r.score.minMinutes,
      spreadMinutes: r.score.spreadMinutes, avgTransfer: r.score.avgTransfer, avgWalking: r.score.avgWalking,
      reason: r.reason, memberRoutes: memberRoutesByStudioId.get(r.studio.id) ?? [],
    }));
    return { searchId, results };
  } catch (e) {
    await getPool().query(
      `UPDATE playground_rehearsal_searches SET search_status='failed', error_note=? WHERE id=?`,
      [String(e instanceof Error ? e.message : e).slice(0, 250), searchId],
    );
    throw e;
  }
}

async function getOrCalcRoute(
  origin: GeoPoint, studio: Studio, mode: RecommendInput["transportMode"],
  timeBucket: TimeBucket, provider: RouteProvider,
): Promise<RouteResult> {
  const cached = await readRouteCache({ origin, destinationId: studio.id, mode, timeBucket });
  if (cached) return cached;
  const route = await provider.getRoute(origin, { lat: studio.lat, lng: studio.lng }, mode);
  await writeRouteCache({ origin, destinationId: studio.id, mode, timeBucket, route });
  return route;
}

async function insertSearch(input: RecommendInput, memberCount: number): Promise<number> {
  const [res] = await getPool().query<ResultSetHeader>(
    `INSERT INTO playground_rehearsal_searches
       (member_count, transport_mode, max_budget_per_hour, required_equipment_json, preferred_region_ids_json, search_status)
     VALUES (?,?,?,?,?, 'pending')`,
    [memberCount, input.transportMode, input.maxBudgetPerHour,
     JSON.stringify(input.requiredEquipment), JSON.stringify(input.preferredRegionIds)],
  );
  const searchId = res.insertId;
  for (const m of input.members) {
    await getPool().query(
      `INSERT INTO playground_rehearsal_search_members
         (search_id, nickname, origin_text, origin_lat, origin_lng, origin_type, transport_mode)
       VALUES (?,?,?,?,?,?,?)`,
      [searchId, m.nickname, m.originText, m.originLat, m.originLng, m.originType, m.transportMode],
    );
  }
  return searchId;
}

async function persistResults(searchId: number, ranked: ReturnType<typeof rankStudios>): Promise<void> {
  for (const r of ranked) {
    await getPool().query(
      `INSERT INTO playground_studio_recommendation_results
         (search_id, studio_id, rank_no, score, avg_minutes, max_minutes, min_minutes, spread_minutes,
          avg_transfer, avg_walking, price_penalty, capacity_penalty, equipment_penalty, fairness_score,
          recommendation_reason, raw_score_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [searchId, r.studio.id, r.rankNo, r.score.score, r.score.avgMinutes, r.score.maxMinutes,
       r.score.minMinutes, r.score.spreadMinutes, r.score.avgTransfer, r.score.avgWalking,
       r.score.pricePenalty, r.score.capacityPenalty, r.score.equipmentPenalty, r.score.fairnessScore,
       r.reason, JSON.stringify(r.score)],
    );
  }
}
