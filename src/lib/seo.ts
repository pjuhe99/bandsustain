import type { Metadata } from "next";
import type { LiveEvent } from "./live";
import type { Member } from "./members";
import type { NewsItem } from "./news";
import type { Song } from "./songs";

export const SITE_URL = "https://bandsustain.com";
export const BAND_NAME = "Band Sustain";
export const BAND_NAME_EN_SHORT = "Sustain";
export const BAND_NAME_KR = "서스테인";
export const BAND_NAME_KR_FULL = "밴드 서스테인";
export const BRAND_SITE_NAME = `${BAND_NAME_KR_FULL} | ${BAND_NAME}`;
export const BRAND_KEYWORDS = [
  BAND_NAME_KR,
  BAND_NAME_KR_FULL,
  BAND_NAME,
  BAND_NAME_EN_SHORT,
  `${BAND_NAME_KR} 밴드`,
  "bandsustain",
];

const DEFAULT_OG_IMAGE = "/slides/hero-a7f3c1e2.jpg";
const BAND_DESCRIPTION =
  "서스테인은 2021년부터 함께한 대한민국 밴드입니다. 산뜻한 팝 감각과 부드러운 멜로디로, 오래 남는 소리와 이어지는 감정을 전합니다.";

const SOCIAL_URLS = [
  "https://www.instagram.com/band_sustain",
  "https://www.youtube.com/@bandsustain1453",
  "https://open.spotify.com/artist/3Zp50Xd4MEceDdVsnPO7Fs",
  "https://www.melon.com/artist/timeline.htm?artistId=3455164",
];

type BuildPageMetadataInput = {
  title: string;
  path: string;
  description: string;
  keywords?: string[];
  ogImage: string;
  type?: "website" | "article";
};

function abs(path: string): string {
  if (/^https?:/.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function uniqueKeywords(keywords: string[] = []): string[] {
  return [...new Set([...BRAND_KEYWORDS, ...keywords])];
}

export function buildRootMetadata(): Metadata {
  const description =
    "2021년부터 함께 음악을 만들어온 대한민국 밴드 서스테인의 공식 사이트입니다. 서스테인의 음악과 공연 일정, 멤버 소개, 뉴스, 플레이그라운드 콘텐츠까지 한 곳에서 만나보실 수 있습니다.";
  const title = `${BAND_NAME_KR_FULL} | ${BAND_NAME} 공식 사이트`;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    keywords: BRAND_KEYWORDS,
    alternates: {
      canonical: SITE_URL,
    },
    openGraph: {
      type: "website",
      siteName: BRAND_SITE_NAME,
      url: SITE_URL,
      title,
      description,
      images: [{ url: DEFAULT_OG_IMAGE, alt: BRAND_SITE_NAME }],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export function buildPageMetadata({
  title,
  path,
  description,
  keywords,
  ogImage,
  type = "website",
}: BuildPageMetadataInput): Metadata {
  const canonicalUrl = abs(path);
  const fullTitle = `${title} | ${BAND_NAME_KR_FULL}`;

  return {
    title: fullTitle,
    description,
    keywords: uniqueKeywords(keywords),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type,
      siteName: BRAND_SITE_NAME,
      url: canonicalUrl,
      title: fullTitle,
      description,
      images: [{ url: ogImage, alt: title }],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage],
    },
  };
}

// mysql2 returns DATE columns as local Date objects, so toISOString() can shift
// the calendar day on a KST server. Keep these schema dates date-only.
function dateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const BAND_REF = {
  "@type": "MusicGroup",
  name: BAND_NAME_KR_FULL,
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
    name: BAND_NAME_KR_FULL,
    alternateName: [BAND_NAME_KR, BAND_NAME, BAND_NAME_EN_SHORT],
    url: SITE_URL,
    image: abs(DEFAULT_OG_IMAGE),
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
    name: `${BAND_NAME_KR_FULL} 음원`,
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
    name: `${BAND_NAME_KR_FULL} - ${e.venue}`,
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
    author: { "@type": "Organization", name: BAND_NAME_KR_FULL, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: BAND_NAME_KR_FULL,
      logo: { "@type": "ImageObject", url: abs("/icon.svg") },
    },
    articleSection: item.category,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/news/${item.id}`,
    },
  };
}

export function buildColumnArticleSchema(post: {
  id: number;
  title: string;
  topicTitle: string;
  authorName: string | null;
  heroImage: string | null;
  publishedAt: Date | null;
  createdAt: Date;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: dateOnly(post.publishedAt ?? post.createdAt),
    ...(post.heroImage ? { image: [abs(post.heroImage)] } : {}),
    author: {
      "@type": post.authorName ? "Person" : "Organization",
      name: post.authorName ?? BAND_NAME_KR_FULL,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: BAND_NAME_KR_FULL,
      logo: { "@type": "ImageObject", url: abs("/icon.svg") },
    },
    articleSection: post.topicTitle,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/columns/${post.id}`,
    },
  };
}
