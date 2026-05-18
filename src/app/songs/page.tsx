import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import SongGrid from "@/components/SongGrid";
import { buildPageMetadata, buildSongsItemListSchema } from "@/lib/seo";
import { getPublishedSongs } from "@/lib/songs";

export const dynamic = "force-dynamic";

const description =
  "밴드 서스테인 음원 페이지. 발매곡과 대표 싱글, 커버 아트와 감상을 한곳에서 확인하세요.";
const ogImage = "/songs/song01.jpg";

export const metadata: Metadata = buildPageMetadata({
  title: "음원",
  path: "/songs",
  description,
  keywords: ["서스테인 음원", "밴드 서스테인 노래", "Band Sustain songs"],
  ogImage,
});

export default async function SongsPage() {
  const all = await getPublishedSongs();

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <JsonLd data={buildSongsItemListSchema(all)} />
      <header className="mb-4">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
          Our Songs
        </h1>
        <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.5]">
          Classics for your new world
          <br />
          새로운 세계에 오래 남을 노래들
        </p>
      </header>

      <blockquote className="max-w-2xl mx-auto text-center my-16 md:my-24 italic text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.7]">
        좋은 곡을 듣는다는 것은,
        <br />
        좋은 때를 안고 산다는 뜻입니다.
        <footer className="mt-4 not-italic text-sm tracking-widest uppercase">
          — 서스테인 —
        </footer>
      </blockquote>

      <SongGrid items={all} />
    </section>
  );
}
