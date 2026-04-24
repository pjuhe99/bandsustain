import type { Metadata } from "next";
import SongGrid from "@/components/SongGrid";
import { sortedByReleaseDesc } from "@/data/songs";

const description = "Classics for your new world — 새로운 세상을 만나게 해줄 명곡들";
const ogImage = "/songs/song01.jpg";

export const metadata: Metadata = {
  title: "Our Songs",
  description,
  openGraph: {
    type: "website",
    siteName: "bandsustain",
    url: "https://bandsustain.com/songs",
    title: "Our Songs — bandsustain",
    description,
    images: [{ url: ogImage, alt: "Our Songs" }],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Songs — bandsustain",
    description,
    images: [ogImage],
  },
};

export default function SongsPage() {
  const all = sortedByReleaseDesc();

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <header className="mb-4">
        <h1 className="font-display font-black uppercase tracking-tight text-4xl md:text-6xl mb-6">
          Our Songs
        </h1>
        <p className="text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.5]">
          Classics for your new world
          <br />
          새로운 세상을 만나게 해줄 명곡들
        </p>
      </header>

      <blockquote className="max-w-2xl mx-auto text-center my-16 md:my-24 italic text-lg md:text-xl text-[var(--color-text-muted)] leading-[1.7]">
        좋은 곡을 듣는다는 것은,
        <br />
        좋은 삶을 살고 있다는 뜻입니다.
        <footer className="mt-4 not-italic text-sm tracking-widest uppercase">
          — 서스테인 —
        </footer>
      </blockquote>

      <SongGrid items={all} />
    </section>
  );
}
