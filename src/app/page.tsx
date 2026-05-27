import Hero from "@/components/Hero";
import JsonLd from "@/components/JsonLd";
import NewsCard from "@/components/NewsCard";
import SongGrid from "@/components/SongGrid";
import UpcomingShowCard from "@/components/UpcomingShowCard";
import { getHomepageUpcomingEvent } from "@/lib/home-live";
import { getUpcomingEvents } from "@/lib/live";
import { getPublishedMembers } from "@/lib/members";
import { getPublishedNews } from "@/lib/news";
import { getPublishedSongs } from "@/lib/songs";
import { buildMusicGroupSchema } from "@/lib/seo";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [songs, latestNewsAll, members, upcomingEvents] = await Promise.all([
    getPublishedSongs(),
    getPublishedNews(),
    getPublishedMembers(),
    getUpcomingEvents(),
  ]);
  const featured = songs.slice(0, 3);
  const latestNews = latestNewsAll.slice(0, 3);
  const upcomingShow = getHomepageUpcomingEvent(upcomingEvents);

  return (
    <>
      <JsonLd data={buildMusicGroupSchema({ members, songs })} />
      <Hero />

      {upcomingShow ? <UpcomingShowCard event={upcomingShow} /> : null}

      {/* About */}
      <section className="border-t border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-16 md:py-24">
          <h2 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tight mb-10 md:mb-12">
            About
          </h2>
          <div className="max-w-2xl">
            <p className="text-base md:text-lg leading-relaxed break-keep mb-6">
              서스테인은 2021년부터 함께 음악을 만들어온 대한민국 밴드입니다. 작은 클럽 무대부터 여러 공식 행사, 팬분들과 만나는 자리까지 다양한 무대에서 관객과 가까이 호흡해 왔습니다. 산뜻한 팝 감각과 부드러운 멜로디로 듣는 분의 마음을 따뜻하게 움직이는 음악을 들려드립니다. 앞으로 이어질 서스테인의 여정도 따뜻하게 지켜봐 주시기 바랍니다. 감사합니다.
            </p>
            <p className="text-xs md:text-sm leading-relaxed text-[var(--color-text-muted)]">
              Sustain is a South Korean band that has been making music together since 2021. From intimate club stages to official events and gatherings with our fans, we have shared the stage close to our audience across all kinds of venues. With a bright pop sensibility and gentle melodies, we bring you music that warms the heart and stays with you. We hope you will follow the journey that lies ahead. Thank you.
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
