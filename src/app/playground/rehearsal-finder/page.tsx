import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { isRehearsalFinderEnabled } from "@/lib/playground/rehearsal/rehearsalFlag";
import { listRegions } from "@/lib/playground/rehearsal/regions";
import { EQUIPMENT_TYPES, EQUIPMENT_LABELS } from "@/lib/playground/rehearsal/types";
import RehearsalFinderClient from "./RehearsalFinderClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "합주실 추천",
  path: "/playground/rehearsal-finder",
  description: "멤버 출발 위치 기반 합주실 추천 (베타).",
  keywords: ["합주실 추천", "밴드 합주실"],
  ogImage: "/slides/hero-b4d9e516.jpg",
});

export default async function RehearsalFinderPage() {
  if (!isRehearsalFinderEnabled()) notFound();
  const regions = await listRegions();
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-20">
      <header className="mb-8">
        <h1 className="font-display font-black uppercase tracking-tight text-3xl md:text-5xl">합주실 추천</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">멤버들의 출발 위치(좌표)를 입력하면 이동시간·가격·장비로 순위를 매겨드려요. (베타 · MockRouteProvider)</p>
      </header>
      <RehearsalFinderClient
        regions={regions.map((r) => ({ id: r.id, displayName: r.displayName }))}
        equipmentOptions={EQUIPMENT_TYPES.map((t) => ({ value: t, label: EQUIPMENT_LABELS[t] }))}
      />
    </section>
  );
}
