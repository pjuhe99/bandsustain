import type { RebirthResult } from "./engine";
import type { SettlementKind } from "./types";

export type ClimateSummary = {
  label: string;
  description: string;
};

export function countryFlag(iso2: string) {
  const letters = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(letters)) return "🌍";
  return String.fromCodePoint(...[...letters].map((letter) => 127_397 + letter.charCodeAt(0)));
}

export function countryFlagUrl(iso2: string) {
  const letters = iso2.toLowerCase();
  return /^[a-z]{2}$/.test(letters) ? `https://flagcdn.com/w80/${letters}.png` : null;
}

export function climateFromLatitude(latitude: number): ClimateSummary {
  const absoluteLatitude = Math.abs(latitude);
  if (absoluteLatitude < 12) return { label: "열대권", description: "덥고 습한 계절이 이어지기 쉬운 위도대" };
  if (absoluteLatitude < 24) return { label: "아열대권", description: "더운 계절이 길고 계절별 비의 차이가 큰 위도대" };
  if (absoluteLatitude < 35) return { label: "온난권", description: "따뜻한 계절과 비교적 온화한 겨울이 교차하는 위도대" };
  if (absoluteLatitude < 55) return { label: "온대권", description: "사계절의 변화가 비교적 뚜렷한 위도대" };
  if (absoluteLatitude < 66) return { label: "냉온대권", description: "겨울이 길거나 기온 차가 큰 위도대" };
  return { label: "한대권", description: "긴 추위와 짧은 여름이 특징인 위도대" };
}

export function locationPopulation(result: RebirthResult) {
  return result.city?.population ?? result.settlement?.population ?? result.country.outsidePopulation;
}

const SETTLEMENT_LABELS: Record<SettlementKind, string> = {
  suburban: "교외·준도시 지역",
  semi_dense_town: "준밀집 소도시",
  dense_town: "밀집 소도시",
  village: "마을",
  dispersed_rural: "분산 농촌",
  very_dispersed_rural: "외딴 농촌",
};

export function settlementLabel(kind: SettlementKind) {
  return SETTLEMENT_LABELS[kind];
}

export function locationName(result: RebirthResult) {
  if (result.city) return result.city.name;
  if (result.settlement) return settlementLabel(result.settlement.kind);
  return "도시 외 지역";
}

export function locationClimate(result: RebirthResult): ClimateSummary | null {
  return result.city ? climateFromLatitude(result.city.latitude) : null;
}

function stableIndex(input: string, length: number) {
  let hash = 0;
  for (const char of input) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % length;
}

export function buildDailyScene(result: RebirthResult) {
  const place = locationName(result);
  const climate = locationClimate(result)?.label ?? "지역마다 다른 기후";
  const topPercent = Math.max(1, 101 - result.percentile);
  const starts = topPercent <= 10
    ? ["아침부터 오늘의 일정과 저녁 약속을 여유 있게 고릅니다.", "준비를 마친 뒤에도 하루의 선택지를 천천히 살핍니다."]
    : topPercent <= 50
      ? ["아침밥과 교통편을 챙기며 오늘 쓸 돈과 시간을 가늠합니다.", "집을 나서기 전, 점심과 다음 주의 작은 계획까지 함께 챙깁니다."]
      : topPercent <= 80
        ? ["아침에는 필요한 일을 먼저 적어 두고, 지출을 한 번 더 살핍니다.", "집을 나서며 오늘 꼭 써야 할 것과 미뤄도 될 것을 나눕니다."]
        : ["아침에는 집안일과 오늘 필요한 것을 먼저 챙긴 뒤 길을 나섭니다.", "가까운 사람들과 필요한 것을 나누며 하루의 우선순위를 정합니다."];
  const middle = result.city
    ? `${place}의 ${climate} 아침 공기와 사람들 사이를 지나`
    : `${place}의 ${climate} 빛과 가까운 길을 따라`;
  const endings = [
    "해가 기울면 가족이나 이웃과 소식을 나누며 저녁을 맞이합니다.",
    "하루 끝에는 가까운 사람들과 식탁이나 골목에서 오늘의 이야기를 나눕니다.",
    "저녁이 되면 주변 사람들의 안부를 묻고, 내일을 준비하며 하루를 접습니다.",
  ];
  const key = `${result.iso3}:${result.location}:${result.percentile}`;
  return `아침, ${middle} ${starts[stableIndex(`${key}:s`, starts.length)]} ${endings[stableIndex(`${key}:e`, endings.length)]}`;
}
