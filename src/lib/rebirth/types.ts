export type RebirthMode = "births" | "population";

export type SettlementKind =
  | "suburban"
  | "semi_dense_town"
  | "dense_town"
  | "village"
  | "dispersed_rural"
  | "very_dispersed_rural";

export type RebirthSettlement = {
  kind: SettlementKind;
  population: number;
};

export type IncomeDistribution = {
  year: number;
  welfareType: "income" | "consumption" | string;
  reportingLevel: "national" | "urban" | "rural" | string;
  values: number[];
};

export type RebirthCity = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  population: number;
  gdpPerCapitaPpp: number | null;
  capital: boolean;
  plausibility: string | null;
};

export type RebirthCountry = {
  iso3: string;
  iso2: string;
  m49: string;
  name: string;
  nameKo: string;
  population: number;
  births: number;
  gdpPerCapitaPpp: number | null;
  outsidePopulation: number;
  settlements: RebirthSettlement[];
  cities: RebirthCity[];
  income: {
    national?: IncomeDistribution;
    urban?: IncomeDistribution;
    rural?: IncomeDistribution;
  };
};

export type RebirthSource = {
  id: string;
  title: string;
  url: string;
  referenceYear: string;
};

export type RebirthData = {
  version: string;
  generatedAt: string;
  targetYear: number;
  gdpYear: number;
  pppYear: number;
  methodology: string[];
  sources: RebirthSource[];
  totals: {
    population: number;
    births: number;
    countries: number;
    cities: number;
    cityPopulation: number;
    incomeCountries: number;
  };
  countries: RebirthCountry[];
};
