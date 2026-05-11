import Hero from "@/components/Hero";
import JsonLd from "@/components/JsonLd";
import NewsCard from "@/components/NewsCard";
import SongGrid from "@/components/SongGrid";
import { getPublishedMembers } from "@/lib/members";
import { getPublishedNews } from "@/lib/news";
import { getPublishedSongs } from "@/lib/songs";
import { buildMusicGroupSchema } from "@/lib/seo";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [songs, latestNewsAll, members] = await Promise.all([
    getPublishedSongs(),
    getPublishedNews(),
    getPublishedMembers(),
  ]);
  const featured = songs.slice(0, 3);
  const latestNews = latestNewsAll.slice(0, 3);

  return (
    <>
      <JsonLd data={buildMusicGroupSchema({ members, songs })} />
      <Hero />

      {/* About */}
      <section className="border-t border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-16 md:py-24">
          <h2 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tight mb-10 md:mb-12">
            About
          </h2>
          <div className="max-w-2xl">
            <p className="text-base md:text-lg leading-relaxed break-keep mb-6">
              서스테인은 2021년에 결성되어 현재까지 활동중인 대한민국의 밴드 입니다. 국내 클럽은 물론 정부 행사와 팬 이벤트 등 다양한 무대에서 관객과 소통하며 음악의 즐거움을 전하고 있습니다. 우리의 음악은 팝적인 감각과 감미로운 선율로 대중의 마음을 움직이는 힘이 있습니다. 앞으로 이어질 우리의 여정을 기대해 주시기 바랍니다. 감사합니다.
            </p>
            <p className="text-xs md:text-sm leading-relaxed text-[var(--color-text-muted)]">
              Sustain is a South Korean band formed in 2021 and is still active today. We share the joy of music with audiences on various stages, including local clubs, government events, and fan gatherings. Our music, with its pop sensibility and melodious touch, has the power to move and inspire people. Please look forward to the journey that lies ahead. Thank you.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Releases */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="flex items-end justify-between mb-10 md:mb-12">
          <div>
            <h2 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tight">
              Featured Releases
            </h2>
            <p className="text-[var(--color-text-muted)] mt-2">Latest and upcoming.</p>
          </div>
          <Link
            href="/songs"
            className="hidden md:inline text-sm underline underline-offset-4"
          >
            View all →
          </Link>
        </div>
        <SongGrid items={featured} />
      </section>

      {/* News */}
      <section className="border-t border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
          <div className="flex items-end justify-between mb-10 md:mb-12">
            <h2 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tight">
              Latest News
            </h2>
            <Link
              href="/news"
              className="hidden md:inline text-sm underline underline-offset-4"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {latestNews.map((n) => (
              <NewsCard key={n.id} item={n} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
