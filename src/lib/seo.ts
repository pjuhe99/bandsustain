import "server-only";
import type { Member } from "./members";
import type { Song } from "./songs";
import type { LiveEvent } from "./live";
import type { NewsItem } from "./news";

export const SITE_URL = "https://bandsustain.com";
export const BAND_NAME = "Sustain";
export const BAND_NAME_KR = "서스테인";

const BAND_DESCRIPTION =
  "오래 남는 소리, 계속 이어지는 감정 — 감성적인 멜로디와 선명한 밴드 사운드로 순간의 마음을 오래 남기는 음악을 만듭니다.";

const SOCIAL_URLS = [
  "https://www.instagram.com/band_sustain",
  "https://www.youtube.com/@bandsustain1453",
  "https://open.spotify.com/artist/3Zp50Xd4MEceDdVsnPO7Fs",
  "https://www.melon.com/artist/timeline.htm?artistId=3455164",
];

function abs(path: string): string {
  if (/^https?:/.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// mysql2 가 DATE 컬럼을 로컬 타임존 자정의 Date 로 돌려주므로 toISOString()
// 으로는 KST 서버에서 하루 어긋난다. 로컬 컴포넌트 추출이 안전.
function dateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const BAND_REF = {
  "@type": "MusicGroup",
  name: BAND_NAME,
  url: SITE_URL,
} as const;

export function buildMusicGroupSchema(opts: {
  members: Member[];
  songs: Song[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    "@id": `${SITE_URL}/#band`,
    name: BAND_NAME,
    alternateName: BAND_NAME_KR,
    url: SITE_URL,
    image: abs("/slides/hero-a7f3c1e2.jpg"),
    logo: abs("/icon.svg"),
    foundingDate: "2021",
    foundingLocation: {
      "@type": "Country",
      name: "South Korea",
    },
    genre: "Pop",
    description: BAND_DESCRIPTION,
    sameAs: SOCIAL_URLS,
    member: opts.members.map((m) => ({
      "@type": "Person",
      name: m.nameEn,
      alternateName: m.nameKr,
      jobTitle: m.position,
      image: abs(m.photoUrl),
    })),
    track: opts.songs.map((s) => ({
      "@type": "MusicRecording",
      name: s.title,
      byArtist: BAND_REF,
      datePublished: dateOnly(s.releasedAt),
      image: abs(s.artworkUrl),
      ...(s.listenUrl ? { url: s.listenUrl } : {}),
    })),
  };
}

export function buildSongsItemListSchema(songs: Song[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${BAND_NAME} — Releases`,
    itemListElement: songs.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "MusicRecording",
        name: s.title,
        byArtist: BAND_REF,
        datePublished: dateOnly(s.releasedAt),
        image: abs(s.artworkUrl),
        ...(s.listenUrl ? { url: s.listenUrl } : {}),
      },
    })),
  };
}

export function buildLiveEventsSchema(events: LiveEvent[]) {
  return events.map((e) => ({
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: `${BAND_NAME} — ${e.venue}`,
    startDate: e.eventDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: e.venue,
      address: {
        "@type": "PostalAddress",
        addressLocality: e.city,
        addressCountry: "KR",
      },
    },
    performer: BAND_REF,
    ...(e.ticketUrl
      ? {
          offers: {
            "@type": "Offer",
            url: e.ticketUrl,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  }));
}

export function buildNewsArticleSchema(item: NewsItem) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: item.headline,
    datePublished: dateOnly(item.date),
    image: [abs(item.heroImage)],
    author: { "@type": "Organization", name: BAND_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: BAND_NAME,
      logo: { "@type": "ImageObject", url: abs("/icon.svg") },
    },
    articleSection: item.category,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/news/${item.id}`,
    },
  };
}
