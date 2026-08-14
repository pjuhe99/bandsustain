import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGunzip } from "node:zlib";
import { parse } from "csv-parse";
import { fromFile } from "geotiff";
import type { IncomeDistribution, RebirthCity, RebirthCountry, RebirthData, RebirthSettlement, SettlementKind } from "../src/lib/rebirth/types";

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, ".cache", "rebirth");
const OUTPUT = path.join(ROOT, "public", "playground", "rebirth", "rebirth-data-v1.json");

const SOURCES = {
  wpp: { filename: "wpp2024-medium.csv.gz", url: "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz" },
  wup: { filename: "wup2025-cities.csv.gz", url: "https://population.un.org/wup/assets/Download/Cities/WUP2025-DB-DEGURBA-Cities-Population-Surface-Data.csv.gz" },
  wupLevel2: { filename: "wup2025-degurba-level2.csv.gz", url: "https://population.un.org/wup/assets/Download/Countries%20and%20Aggregates/WUP2025-DB-DEGURBA-Level2-Population-Surface-Data.csv.gz" },
  pip: { filename: "world-bank-pip-100bin.csv", url: "https://datacatalogfiles.worldbank.org/ddh-published/0063646/DR0090357/world_100bin_revised.csv" },
  gdpRaster: { filename: "gdp-per-capita-1990-2022-30arcmin.tif", url: "https://zenodo.org/api/records/16741980/files/rast_adm2_gdp_perCapita_1990_2022_30arcmin.tif/content" },
  gdpCountry: { filename: "gdp-per-capita-adm0.csv", url: "https://zenodo.org/api/records/16741980/files/tabulated_adm0_gdp_perCapita.csv/content" },
} as const;

type CsvRow = Record<string, string>;
type CountryBase = Omit<RebirthCountry, "cities" | "settlements" | "outsidePopulation" | "income" | "gdpPerCapitaPpp">;

const LEVEL2_CATEGORIES = new Map<string, SettlementKind>([
  ["11", "very_dispersed_rural"],
  ["12", "dispersed_rural"],
  ["13", "village"],
  ["21", "suburban"],
  ["22", "semi_dense_town"],
  ["23", "dense_town"],
]);

async function exists(filePath: string) {
  try { return (await stat(filePath)).size > 0; } catch { return false; }
}

async function download(url: string, destination: string) {
  if (await exists(destination)) return;
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function forEachCsv(filePath: string, compressed: boolean, onRow: (row: CsvRow) => void) {
  const input = createReadStream(filePath);
  const source = compressed ? input.pipe(createGunzip()) : input;
  const parser = source.pipe(parse({ columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }));
  for await (const row of parser) onRow(row as CsvRow);
}

function finiteNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rounded(value: number, digits = 0) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function koreanCountryName(iso2: string, fallback: string) {
  try { return new Intl.DisplayNames(["ko"], { type: "region" }).of(iso2) ?? fallback; } catch { return fallback; }
}

async function loadCountries(filePath: string) {
  const countries = new Map<string, CountryBase>();
  await forEachCsv(filePath, true, (row) => {
    if (row.Time !== "2026" || row.LocTypeID !== "4" || !row.ISO3_code) return;
    const population = Math.round(finiteNumber(row.TPopulation1July) * 1_000);
    const births = Math.round(finiteNumber(row.Births) * 1_000);
    if (population <= 0 || births < 0) return;
    const iso2 = row.ISO2_code || "";
    countries.set(row.ISO3_code, { iso3: row.ISO3_code, iso2, m49: String(Number(row.LocID)).padStart(3, "0"), name: row.Location, nameKo: koreanCountryName(iso2, row.Location), population, births });
  });
  return countries;
}

async function loadCities(filePath: string, countryCodes: Set<string>) {
  const cities = new Map<string, RebirthCity[]>();
  await forEachCsv(filePath, true, (row) => {
    const iso3 = row.ISO3_Code;
    if (row.Year !== "2026" || !countryCodes.has(iso3)) return;
    const population = Math.round(finiteNumber(row.Pop) * 1_000);
    const latitude = finiteNumber(row.PWCent_Latitude);
    const longitude = finiteNumber(row.PWCent_Longitude);
    if (population <= 0 || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
    const countryCities = cities.get(iso3) ?? [];
    countryCities.push({ id: Number(row.City_Code), name: row.City_Name, latitude: rounded(latitude, 4), longitude: rounded(longitude, 4), population, gdpPerCapitaPpp: null, capital: Boolean(row.Capital?.trim()), plausibility: row.Pop_plausibility || null });
    cities.set(iso3, countryCities);
  });
  return cities;
}

async function loadSettlements(filePath: string, countryCodes: Set<string>) {
  const settlements = new Map<string, RebirthSettlement[]>();
  await forEachCsv(filePath, true, (row) => {
    const iso3 = row.ISO3_Code;
    const kind = LEVEL2_CATEGORIES.get(row.Category_order);
    if (row.Year !== "2026" || row.LocType !== "4" || !countryCodes.has(iso3) || !kind) return;
    const population = Math.round(finiteNumber(row.Pop) * 1_000);
    if (population <= 0) return;
    const countrySettlements = settlements.get(iso3) ?? [];
    countrySettlements.push({ kind, population });
    settlements.set(iso3, countrySettlements);
  });
  return settlements;
}

async function loadIncomeDistributions(filePath: string) {
  const latest = new Map<string, IncomeDistribution & { slots: Map<number, number> }>();
  await forEachCsv(filePath, false, (row) => {
    const iso3 = row.country_code;
    const level = row.reporting_level;
    const year = Number(row.year);
    const percentile = Number(row.percentile);
    const welfare = Number(row.avg_welfare);
    if (!iso3 || !level || !Number.isInteger(year) || percentile < 1 || percentile > 100 || welfare <= 0) return;
    const key = `${iso3}:${level}`;
    const previous = latest.get(key);
    if (!previous || year > previous.year) {
      latest.set(key, { year, welfareType: row.welfare_type, reportingLevel: level, values: [], slots: new Map([[percentile, welfare]]) });
    } else if (year === previous.year) previous.slots.set(percentile, welfare);
  });

  const byCountry = new Map<string, RebirthCountry["income"]>();
  for (const [key, distribution] of latest) {
    const [iso3, level] = key.split(":");
    const values = Array.from({ length: 100 }, (_, index) => distribution.slots.get(index + 1));
    if (values.some((value) => !value)) continue;
    const clean: IncomeDistribution = { year: distribution.year, welfareType: distribution.welfareType, reportingLevel: distribution.reportingLevel, values: values.map((value) => rounded(value!, 3)) };
    const income = byCountry.get(iso3) ?? {};
    if (level === "national" || level === "urban" || level === "rural") {
      income[level] = clean;
      byCountry.set(iso3, income);
    }
  }
  return byCountry;
}

async function loadCountryGdp(filePath: string) {
  const byCountry = new Map<string, number>();
  await forEachCsv(filePath, false, (row) => {
    const value = finiteNumber(row["2022"]);
    if (row.iso3 && value > 0) byCountry.set(row.iso3, rounded(value));
  });
  return byCountry;
}

async function addCityGdp(filePath: string, cities: Map<string, RebirthCity[]>) {
  const tiff = await fromFile(filePath);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const sample = (await image.readRasters({ samples: [32] }))[0];
  let populated = 0;
  for (const countryCities of cities.values()) {
    for (const city of countryCities) {
      const x = Math.max(0, Math.min(width - 1, Math.floor(((city.longitude + 180) / 360) * width)));
      const y = Math.max(0, Math.min(height - 1, Math.floor(((90 - city.latitude) / 180) * height)));
      const value = Number(sample[y * width + x]);
      if (value > 0 && value !== 4_294_967_295) {
        city.gdpPerCapitaPpp = Math.round(value);
        populated += 1;
      }
    }
  }
  await tiff.close();
  return populated;
}

function reconcileCityPopulations(population: number, cities: RebirthCity[]) {
  const rawTotal = cities.reduce((sum, city) => sum + city.population, 0);
  if (rawTotal <= population) return Math.max(0, population - rawTotal);
  const scale = population / rawTotal;
  for (const city of cities) city.population = Math.max(1, Math.round(city.population * scale));
  return 0;
}

function reconcileSettlements(outsidePopulation: number, raw: RebirthSettlement[]) {
  const rawTotal = raw.reduce((sum, settlement) => sum + settlement.population, 0);
  if (outsidePopulation <= 0 || rawTotal <= 0) return [];
  const scaled = raw.map((settlement) => {
    const exact = settlement.population / rawTotal * outsidePopulation;
    return { ...settlement, population: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remainder = outsidePopulation - scaled.reduce((sum, settlement) => sum + settlement.population, 0);
  scaled.sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; remainder > 0; index = (index + 1) % scaled.length, remainder -= 1) {
    scaled[index].population += 1;
  }
  return scaled
    .filter((settlement) => settlement.population > 0)
    .map(({ kind, population }) => ({ kind, population }));
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  for (const source of Object.values(SOURCES)) await download(source.url, path.join(CACHE_DIR, source.filename));

  const countryBases = await loadCountries(path.join(CACHE_DIR, SOURCES.wpp.filename));
  const citiesByCountry = await loadCities(path.join(CACHE_DIR, SOURCES.wup.filename), new Set(countryBases.keys()));
  const settlementsByCountry = await loadSettlements(path.join(CACHE_DIR, SOURCES.wupLevel2.filename), new Set(countryBases.keys()));
  const incomeByCountry = await loadIncomeDistributions(path.join(CACHE_DIR, SOURCES.pip.filename));
  const countryGdp = await loadCountryGdp(path.join(CACHE_DIR, SOURCES.gdpCountry.filename));
  const cityGdpCount = await addCityGdp(path.join(CACHE_DIR, SOURCES.gdpRaster.filename), citiesByCountry);

  const countries: RebirthCountry[] = [];
  for (const base of countryBases.values()) {
    const cities = (citiesByCountry.get(base.iso3) ?? []).sort((a, b) => b.population - a.population);
    const nationalGdp = countryGdp.get(base.iso3) ?? null;
    for (const city of cities) city.gdpPerCapitaPpp ??= nationalGdp;
    const outsidePopulation = reconcileCityPopulations(base.population, cities);
    const settlements = reconcileSettlements(outsidePopulation, settlementsByCountry.get(base.iso3) ?? []);
    countries.push({ ...base, gdpPerCapitaPpp: nationalGdp, outsidePopulation, settlements, cities, income: incomeByCountry.get(base.iso3) ?? {} });
  }
  countries.sort((a, b) => a.iso3.localeCompare(b.iso3));

  const data: RebirthData = {
    version: "2026.2",
    generatedAt: new Date().toISOString(),
    targetYear: 2026,
    gdpYear: 2022,
    pppYear: 2021,
    methodology: [
      "국가는 2026년 출생아 수 또는 인구에 비례해 추첨합니다.",
      "국가 안에서는 2026년 도시 인구 비중으로 도시를 추첨하고, 나머지는 UN의 6개 정착지 유형 비중으로 나눕니다.",
      "가정의 경제 수준은 세계은행 PIP의 최신 100분위 소득·소비 분포를 균등한 백분위로 뽑습니다.",
      "도시별 GDP 차이는 국가 분포를 보수적으로 보정하는 모델이며 개인 소득을 뜻하지 않습니다.",
    ],
    sources: [
      { id: "wpp", title: "UN World Population Prospects 2024", url: "https://population.un.org/wpp/", referenceYear: "2026 medium projection" },
      { id: "wup", title: "UN World Urbanization Prospects 2025", url: "https://population.un.org/wup/", referenceYear: "2026 city and Degree of Urbanization Level 2 projection" },
      { id: "pip", title: "World Bank Poverty and Inequality Platform", url: "https://pip.worldbank.org/", referenceYear: "latest survey by country, 2021 PPP" },
      { id: "gdp", title: "Kummu et al. global subnational GDP per capita", url: "https://doi.org/10.5281/zenodo.16741980", referenceYear: "2022, 2021 PPP" },
    ],
    totals: {
      population: countries.reduce((sum, country) => sum + country.population, 0),
      births: countries.reduce((sum, country) => sum + country.births, 0),
      countries: countries.length,
      cities: countries.reduce((sum, country) => sum + country.cities.length, 0),
      cityPopulation: countries.reduce((sum, country) => sum + country.cities.reduce((citySum, city) => citySum + city.population, 0), 0),
      incomeCountries: countries.filter((country) => Object.keys(country.income).length > 0).length,
    },
    countries,
  };

  await writeFile(OUTPUT, `${JSON.stringify(data)}\n`);
  const bytes = (await readFile(OUTPUT)).byteLength;
  console.log(JSON.stringify({ output: OUTPUT, bytes, countries: data.totals.countries, cities: data.totals.cities, incomeCountries: data.totals.incomeCountries, cityGdpCount, population: data.totals.population, births: data.totals.births }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
