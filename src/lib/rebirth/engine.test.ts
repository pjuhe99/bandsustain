import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeRebirthSeed,
  drawRebirth,
  encodeRebirthSeed,
  pickWeighted,
  restoreRebirth,
} from "./engine";
import type { RebirthData } from "./types";

const data: RebirthData = {
  version: "test",
  generatedAt: "2026-01-01T00:00:00.000Z",
  targetYear: 2026,
  gdpYear: 2022,
  pppYear: 2021,
  methodology: [],
  sources: [],
  totals: { population: 1_000, births: 100, countries: 1, cities: 1, cityPopulation: 600, incomeCountries: 1 },
  countries: [{
    iso3: "TST", iso2: "TS", m49: "999", name: "Test", nameKo: "테스트", population: 1_000,
    births: 100, gdpPerCapitaPpp: 20_000, outsidePopulation: 400,
    settlements: [
      { kind: "village", population: 250 },
      { kind: "dispersed_rural", population: 150 },
    ],
    cities: [{ id: 7, name: "Test City", latitude: 1, longitude: 2, population: 600, gdpPerCapitaPpp: 40_000, capital: true, plausibility: null }],
    income: { national: { year: 2020, welfareType: "income", reportingLevel: "national", values: Array.from({ length: 100 }, (_, i) => i + 1) } },
  }],
};

test("weighted picker respects deterministic boundaries", () => {
  assert.equal(pickWeighted([1, 2], (value) => value, () => 0).item, 1);
  assert.equal(pickWeighted([1, 2], (value) => value, () => 0.9).item, 2);
});

test("draw, encode, decode and restore preserve a result", () => {
  const sequence = [0.2, 0.1, 0.499];
  const result = drawRebirth(data, "births", () => sequence.shift() ?? 0);
  assert.ok(result);
  assert.equal(result.city?.id, 7);
  assert.equal(result.percentile, 50);
  assert.ok(result.globalPercentile >= 1 && result.globalPercentile <= 100);
  assert.ok(result.monthlyWelfarePpp > 0);
  const encoded = encodeRebirthSeed(result);
  const decoded = decodeRebirthSeed(encoded);
  assert.ok(decoded);
  assert.equal(restoreRebirth(data, decoded)?.city?.id, 7);
});

test("global economic percentile is population weighted", () => {
  const comparison: RebirthData = structuredClone(data);
  comparison.countries.push({
    ...structuredClone(data.countries[0]),
    iso3: "RCH",
    population: 3_000,
    births: 300,
    cities: [],
    outsidePopulation: 3_000,
    settlements: [{ kind: "village", population: 3_000 }],
    income: {
      national: {
        year: 2020,
        welfareType: "income",
        reportingLevel: "national",
        values: Array.from({ length: 100 }, () => 1_000),
      },
    },
  });
  comparison.totals.population = 4_000;
  comparison.totals.births = 400;
  comparison.totals.countries = 2;
  const result = restoreRebirth(comparison, { mode: "population", iso3: "TST", location: 7, percentile: 50 });
  assert.equal(result?.globalPercentile, 16);
});

test("non-city outcomes use the finer settlement categories", () => {
  const sequence = [0, 0.99, 0];
  const result = drawRebirth(data, "population", () => sequence.shift() ?? 0);
  assert.equal(result?.isOutsideCity, true);
  assert.equal(result?.settlement?.kind, "dispersed_rural");
  assert.equal(result?.locationProbability, 0.15);
  const encoded = encodeRebirthSeed(result!);
  assert.equal(encoded, "p.TST.r.1");
  assert.equal(restoreRebirth(data, decodeRebirthSeed(encoded)!)?.settlement?.kind, "dispersed_rural");
});

test("legacy outside-city share seeds remain valid", () => {
  const decoded = decodeRebirthSeed("b.TST.o.50");
  assert.ok(decoded);
  const result = restoreRebirth(data, decoded);
  assert.equal(result?.isOutsideCity, true);
  assert.equal(result?.settlement, null);
  assert.equal(result?.locationProbability, 0.4);
});

test("missing surveys fall back to a finite modeled distribution", () => {
  const modeled: RebirthData = structuredClone(data);
  modeled.countries[0].income = {};
  const result = drawRebirth(modeled, "births", () => 0.1);
  assert.equal(result?.incomeQuality, "modeled");
  assert.ok(Number.isFinite(result?.dailyWelfarePpp));
});

test("invalid share seeds are rejected", () => {
  assert.equal(decodeRebirthSeed("x.KOR.o.50"), null);
  assert.equal(decodeRebirthSeed("b.KOR.o.101"), null);
});
