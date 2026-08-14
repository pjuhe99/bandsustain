"use client";

import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { RebirthResult } from "@/lib/rebirth/engine";
import { locationName } from "@/lib/rebirth/scene";

const WIDTH = 960;
const HEIGHT = 500;

type AtlasFeature = Feature<Geometry> & { id?: string | number };

export default function RebirthMap({ result }: { result: RebirthResult | null }) {
  const { countries, path, pin } = useMemo(() => {
    const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
    const collection = feature(
      world as unknown as Parameters<typeof feature>[0],
      world.objects.countries as unknown as Parameters<typeof feature>[1],
    ) as unknown as FeatureCollection<Geometry>;
    const pinPosition = result?.city
      ? projection([result.city.longitude, result.city.latitude])
      : null;
    return {
      countries: collection.features,
      path: geoPath(projection),
      pin: pinPosition,
    };
  }, [result]);

  const selectedId = result ? Number(result.country.m49) : null;
  const label = result
    ? `${result.country.nameKo}, ${locationName(result)} 위치 지도`
    : "전 세계 환생 위치 지도";

  return (
    <div className="relative overflow-hidden border border-[var(--color-border)] bg-[#f6f8fb]">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="block h-auto w-full">
        <path d={path({ type: "Sphere" }) ?? undefined} fill="#f6f8fb" />
        {countries.map((country, index) => {
          const atlasCountry = country as AtlasFeature;
          const active = selectedId !== null && Number(atlasCountry.id) === selectedId;
          return (
            <path
              key={`${atlasCountry.id ?? "country"}-${index}`}
              d={path(country) ?? undefined}
              fill={active ? "var(--color-accent)" : "#d9dee8"}
              stroke="#ffffff"
              strokeWidth={active ? 1.4 : 0.55}
              className="transition-colors duration-500"
            />
          );
        })}
        {pin && (
          <g transform={`translate(${pin[0]} ${pin[1]})`}>
            <circle r="9" fill="var(--color-accent)" opacity="0.2" />
            <circle r="4.5" fill="#ffffff" stroke="var(--color-accent)" strokeWidth="3" />
          </g>
        )}
      </svg>
      {!result && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/30">
          <span className="bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] shadow-sm">
            아직 정해지지 않은 운명
          </span>
        </div>
      )}
      {result?.city && (
        <span className="absolute bottom-3 left-3 bg-white/90 px-3 py-2 text-xs font-semibold shadow-sm">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" aria-hidden />
          흰 점(파란 테두리) = {result.city.name} 위치
        </span>
      )}
      {result && !result.city && (
        <span className="absolute bottom-3 left-3 bg-white/90 px-3 py-2 text-xs font-semibold shadow-sm">
          <span className="mr-2 inline-block h-2 w-2 bg-[var(--color-accent)]" aria-hidden />
          파란색 = {result.country.nameKo} 국가 범위 · 정확한 지점은 미지정
        </span>
      )}
    </div>
  );
}
