import type {
  IncomeDistribution,
  RebirthCity,
  RebirthCountry,
  RebirthData,
  RebirthMode,
  RebirthSettlement,
  SettlementKind,
} from "./types";

export type RandomSource = () => number;

export type RebirthSeed = {
  mode: RebirthMode;
  iso3: string;
  location: number | SettlementKind | "outside";
  percentile: number;
};

export type RebirthResult = RebirthSeed & {
  country: RebirthCountry;
  city: RebirthCity | null;
  settlement: RebirthSettlement | null;
  isOutsideCity: boolean;
  countryProbability: number;
  locationProbability: number;
  combinedProbability: number;
  dailyWelfarePpp: number;
  monthlyWelfarePpp: number;
  nationalPercentile: number;
  globalPercentile: number;
  incomeYear: number | null;
  welfareType: string;
  reportingLevel: string;
  incomeQuality: "survey" | "modeled";
  spatialFactor: number;
  localGdpRatio: number | null;
};

function cryptoRandom() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] / 4_294_967_296;
  }
  return Math.random();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function pickWeighted<T>(
  items: T[],
  getWeight: (item: T) => number,
  rng: RandomSource = cryptoRandom,
) {
  const total = items.reduce((sum, item) => sum + Math.max(0, getWeight(item)), 0);
  if (total <= 0) throw new Error("추첨할 수 있는 가중치가 없습니다.");
  let cursor = clamp(rng(), 0, 0.999999999999) * total;
  for (const item of items) {
    cursor -= Math.max(0, getWeight(item));
    if (cursor < 0) return { item, total };
  }
  return { item: items[items.length - 1], total };
}

function normalQuantile(probability: number) {
  // Peter J. Acklam's inverse-normal approximation.
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const low = 0.02425;
  const high = 1 - low;
  if (probability < low) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (probability > high) {
    const q = Math.sqrt(-2 * Math.log(1 - probability));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = probability - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function modeledDistribution(country: RebirthCountry): IncomeDistribution {
  const meanDaily = Math.max(2, (country.gdpPerCapitaPpp ?? 12_000) / 365.25 * 0.62);
  const sigma = 0.82;
  const mu = Math.log(meanDaily) - (sigma * sigma) / 2;
  return {
    year: 2022,
    welfareType: "modeled",
    reportingLevel: "national",
    values: Array.from({ length: 100 }, (_, index) =>
      Math.exp(mu + sigma * normalQuantile((index + 0.5) / 100)),
    ),
  };
}

const URBAN_SETTLEMENTS = new Set<SettlementKind>(["suburban", "semi_dense_town", "dense_town"]);

function selectDistribution(country: RebirthCountry, city: RebirthCity | null, settlement: RebirthSettlement | null) {
  const preferred = city || (settlement && URBAN_SETTLEMENTS.has(settlement.kind))
    ? country.income.urban ?? country.income.national
    : country.income.rural ?? country.income.national;
  return {
    distribution: preferred ?? modeledDistribution(country),
    quality: preferred ? ("survey" as const) : ("modeled" as const),
  };
}

function globalPercentile(data: RebirthData, dailyWelfarePpp: number) {
  let populationAtOrBelow = 0;
  let totalPopulation = 0;
  for (const country of data.countries) {
    const distribution = country.income.national
      ?? country.income.urban
      ?? country.income.rural
      ?? modeledDistribution(country);
    const values = distribution.values.filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length || country.population <= 0) continue;
    const binsAtOrBelow = values.reduce(
      (count, value) => count + (value <= dailyWelfarePpp ? 1 : 0),
      0,
    );
    populationAtOrBelow += country.population * (binsAtOrBelow / values.length);
    totalPopulation += country.population;
  }
  if (totalPopulation <= 0) return 1;
  return clamp(Math.round(populationAtOrBelow / totalPopulation * 100), 1, 100);
}

function buildResult(data: RebirthData, seed: RebirthSeed): RebirthResult | null {
  const country = data.countries.find((candidate) => candidate.iso3 === seed.iso3);
  if (!country || seed.percentile < 1 || seed.percentile > 100) return null;
  const city = typeof seed.location === "number"
    ? country.cities.find((candidate) => candidate.id === seed.location) ?? null
    : null;
  const settlements = country.settlements ?? [];
  const settlement = typeof seed.location === "string" && seed.location !== "outside"
    ? settlements.find((candidate) => candidate.kind === seed.location) ?? null
    : null;
  if (typeof seed.location === "number" && !city) return null;
  if (seed.location !== "outside" && typeof seed.location === "string" && !settlement) return null;

  const countryWeight = seed.mode === "births" ? country.births : country.population;
  const worldWeight = data.countries.reduce(
    (sum, candidate) => sum + (seed.mode === "births" ? candidate.births : candidate.population),
    0,
  );
  const locationWeight = city?.population ?? settlement?.population ?? country.outsidePopulation;
  const locationTotal = country.cities.reduce((sum, candidate) => sum + candidate.population, country.outsidePopulation);
  const { distribution, quality } = selectDistribution(country, city, settlement);
  const baseDaily = distribution.values[seed.percentile - 1];
  if (!Number.isFinite(baseDaily) || baseDaily <= 0) return null;

  const localGdpRatio = city?.gdpPerCapitaPpp && country.gdpPerCapitaPpp
    ? city.gdpPerCapitaPpp / country.gdpPerCapitaPpp
    : null;
  const spatialFactor = city
    ? localGdpRatio
      ? clamp(localGdpRatio ** 0.35, 0.55, 1.8)
      : 1
    : distribution.reportingLevel === "rural" || distribution.reportingLevel === "urban"
      ? 1
      : settlement && URBAN_SETTLEMENTS.has(settlement.kind)
        ? 0.9
        : 0.82;
  const dailyWelfarePpp = baseDaily * spatialFactor;
  const countryProbability = worldWeight > 0 ? countryWeight / worldWeight : 0;
  const locationProbability = locationTotal > 0 ? locationWeight / locationTotal : 0;

  return {
    ...seed,
    country,
    city,
    settlement,
    isOutsideCity: !city,
    countryProbability,
    locationProbability,
    combinedProbability: countryProbability * locationProbability * 0.01,
    dailyWelfarePpp,
    monthlyWelfarePpp: dailyWelfarePpp * (365.25 / 12),
    nationalPercentile: seed.percentile,
    globalPercentile: globalPercentile(data, dailyWelfarePpp),
    incomeYear: quality === "survey" ? distribution.year : null,
    welfareType: distribution.welfareType,
    reportingLevel: distribution.reportingLevel,
    incomeQuality: quality,
    spatialFactor,
    localGdpRatio,
  };
}

export function drawRebirth(
  data: RebirthData,
  mode: RebirthMode,
  rng: RandomSource = cryptoRandom,
) {
  const { item: country } = pickWeighted(
    data.countries,
    (candidate) => mode === "births" ? candidate.births : candidate.population,
    rng,
  );
  const settlements = country.settlements ?? [];
  const locations: Array<{ city: RebirthCity | null; settlement: RebirthSettlement | null; weight: number }> = [
    ...country.cities.map((city) => ({ city, settlement: null, weight: city.population })),
    ...settlements.map((settlement) => ({ city: null, settlement, weight: settlement.population })),
    ...(settlements.length === 0 && country.outsidePopulation > 0
      ? [{ city: null, settlement: null, weight: country.outsidePopulation }]
      : []),
  ].filter((location) => location.weight > 0);
  const { item: location } = pickWeighted(locations, (candidate) => candidate.weight, rng);
  const percentile = Math.min(100, Math.floor(clamp(rng(), 0, 0.999999999999) * 100) + 1);
  return buildResult(data, {
    mode,
    iso3: country.iso3,
    location: location.city?.id ?? location.settlement?.kind ?? "outside",
    percentile,
  });
}

export function restoreRebirth(data: RebirthData, seed: RebirthSeed) {
  return buildResult(data, seed);
}

export function encodeRebirthSeed(seed: RebirthSeed) {
  const mode = seed.mode === "births" ? "b" : "p";
  const settlementCodes: Record<SettlementKind, string> = {
    suburban: "s",
    semi_dense_town: "t",
    dense_town: "d",
    village: "v",
    dispersed_rural: "r",
    very_dispersed_rural: "x",
  };
  const location = seed.location === "outside"
    ? "o"
    : typeof seed.location === "number"
      ? String(seed.location)
      : settlementCodes[seed.location];
  return `${mode}.${seed.iso3}.${location}.${seed.percentile}`;
}

export function decodeRebirthSeed(value: string | null): RebirthSeed | null {
  if (!value) return null;
  const [modeCode, iso3, locationCode, percentileCode, ...rest] = value.split(".");
  if (rest.length || !/^[A-Z]{3}$/.test(iso3 ?? "")) return null;
  const percentile = Number(percentileCode);
  const settlementCodes: Record<string, SettlementKind> = {
    s: "suburban",
    t: "semi_dense_town",
    d: "dense_town",
    v: "village",
    r: "dispersed_rural",
    x: "very_dispersed_rural",
  };
  const location = locationCode === "o" ? "outside" : settlementCodes[locationCode] ?? Number(locationCode);
  if ((modeCode !== "b" && modeCode !== "p") || !Number.isInteger(percentile) || percentile < 1 || percentile > 100 || (typeof location === "number" && !Number.isInteger(location))) return null;
  return { mode: modeCode === "b" ? "births" : "population", iso3, location, percentile };
}
