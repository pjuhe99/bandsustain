import type { getUpcomingEvents } from "./live";
import type { getPublishedMembers } from "./members";
import type { getPublishedNews } from "./news";
import type { getPublishedSongs } from "./songs";

import "server-only";

export type OfficialContextNeeds = {
  live: boolean;
  members: boolean;
  songs: boolean;
  news: boolean;
};

export type OfficialLiveContextItem = {
  eventDate: string;
  venue: string;
  city: string;
  ticketUrl: string | null;
  videoUrl: string | null;
};

export type OfficialMemberContextItem = {
  nameKr: string;
  nameEn: string;
  position: string;
  favoriteArtist: string | null;
  favoriteSong: string | null;
};

export type OfficialSongContextItem = {
  title: string;
  category: string;
  releasedAt: string;
  listenUrl: string | null;
};

export type OfficialNewsContextItem = {
  headline: string;
  date: string;
  category: string;
  summary: string;
};

export type OfficialContextData = {
  live: OfficialLiveContextItem[];
  members: OfficialMemberContextItem[];
  songs: OfficialSongContextItem[];
  news: OfficialNewsContextItem[];
};

type OfficialContextDeps = {
  getUpcomingEvents: typeof getUpcomingEvents;
  getPublishedMembers: typeof getPublishedMembers;
  getPublishedSongs: typeof getPublishedSongs;
  getPublishedNews: typeof getPublishedNews;
};

type BuildDeps = Partial<OfficialContextDeps>;

type ModuleExports<T> = T extends { default: infer D } ? D : T;

function getModuleExports<T extends object>(moduleNs: T | { default: T }): T {
  return ("default" in moduleNs ? moduleNs.default : moduleNs) as T;
}

const LIVE_KEYWORDS = [
  "live",
  "concert",
  "gig",
  "performance",
  "tour",
  "venue",
  "schedule",
  "upcoming",
  "ticket link",
  "ticket info",
  "ticket url",
  "ticketing",
  "buy tickets",
  "tickets for",
  "concert ticket",
  "공연",
  "라이브",
  "콘서트",
  "일정",
  "티켓",
];

const MEMBER_KEYWORDS = [
  "member",
  "members",
  "band member",
  "lineup",
  "member list",
  "멤버",
  "구성원",
  "라인업",
];

const SONG_KEYWORDS = [
  "song",
  "songs",
  "track",
  "album",
  "ep",
  "single",
  "music video",
  "노래",
  "곡",
  "앨범",
  "싱글",
  "발매",
  "음원",
];

const NEWS_KEYWORDS = [
  "news",
  "news article",
  "news story",
  "press release",
  "뉴스",
  "소식",
  "기사",
  "보도",
];

function isAsciiWord(keyword: string): boolean {
  return /^[a-z0-9]+(?: [a-z0-9]+)*$/i.test(keyword);
}

function includesAnyKeyword(message: string, keywords: string[]): boolean {
  const lowered = message.toLowerCase();
  return keywords.some((keyword) => {
    const needle = keyword.toLowerCase();
    if (isAsciiWord(needle)) {
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(lowered);
    }
    return lowered.includes(needle);
  });
}

function formatMonthDay(eventDate: string): string {
  const [year, month, day] = eventDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "2-digit",
  }).format(date).toUpperCase();
}

function formatLiveDateFallback(eventDate: string): string {
  return `${formatMonthDay(eventDate)} · ${eventDate.slice(0, 4)}`;
}

function formatDateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeForLooseMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function messageMentionsMemberName(message: string, members: { nameKr: string; nameEn: string }[]): boolean {
  const normalizedMessage = normalizeForLooseMatch(message);
  if (!normalizedMessage) return false;
  return members.some((member) => {
    const candidates = [member.nameKr, member.nameEn].map(normalizeForLooseMatch).filter(Boolean);
    return candidates.some((candidate) => normalizedMessage.includes(candidate));
  });
}

function excerptFallback(body: string, max: number): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (max <= 0) return "";
  if (flat.length <= max) return flat;
  if (max <= 3) return flat.slice(0, max);
  return `${flat.slice(0, max - 3).trimEnd()}...`;
}

function formatNewsDateFallback(date: Date): string {
  return formatDateOnly(date);
}

export function classifyOfficialContextNeeds(message: string): OfficialContextNeeds {
  return {
    live: includesAnyKeyword(message, LIVE_KEYWORDS),
    members: includesAnyKeyword(message, MEMBER_KEYWORDS),
    songs: includesAnyKeyword(message, SONG_KEYWORDS),
    news: includesAnyKeyword(message, NEWS_KEYWORDS),
  };
}

function formatLiveItem(item: OfficialLiveContextItem): string {
  const parts = [item.eventDate, item.city, item.venue];
  if (item.ticketUrl) parts.push("ticket link");
  if (item.videoUrl) parts.push("video link");
  return `- ${parts.join(" / ")}`;
}

function formatMemberItem(item: OfficialMemberContextItem): string {
  const parts = [`${item.nameKr} (${item.nameEn})`, item.position];
  if (item.favoriteArtist) parts.push(`favorite artist: ${item.favoriteArtist}`);
  if (item.favoriteSong) parts.push(`favorite song: ${item.favoriteSong}`);
  return `- ${parts.join(" / ")}`;
}

function formatSongItem(item: OfficialSongContextItem): string {
  const parts = [item.title, item.category, item.releasedAt, item.listenUrl ? "listen link" : "no listen link"];
  return `- ${parts.join(" / ")}`;
}

function formatNewsItem(item: OfficialNewsContextItem): string {
  return `- ${item.date} / ${item.category} / ${item.headline} / ${item.summary}`;
}

export function formatOfficialContext(data: OfficialContextData): string | null {
  const sections: string[] = [];

  if (data.live.length > 0) {
    sections.push(["### Upcoming Live", ...data.live.map(formatLiveItem)].join("\n"));
  }

  if (data.members.length > 0) {
    sections.push(["### Members", ...data.members.map(formatMemberItem)].join("\n"));
  }

  if (data.songs.length > 0) {
    sections.push(["### Songs", ...data.songs.map(formatSongItem)].join("\n"));
  }

  if (data.news.length > 0) {
    sections.push(["### News", ...data.news.map(formatNewsItem)].join("\n"));
  }

  if (sections.length === 0) return null;

  return [
    "## Official Bandsustain Context",
    "Use this context only when it is relevant to the user's question.",
    "Members, songs, and live items are official site-backed facts.",
    "Any published songs listed here are already released songs, not upcoming releases.",
    "News items are site content but may be playful, fictional, or exaggerated editorial writing.",
    "",
    ...sections,
  ].join("\n");
}

export function buildYeongminRuntimeContext(
  now: Date = new Date(),
  options?: { outputMaxChars?: number; outputMaxLines?: number },
): string {
  const outputRule =
    options?.outputMaxChars && options?.outputMaxLines
      ? `Keep every reply within ${options.outputMaxChars} characters and ${options.outputMaxLines} lines, even if the user asks for a longer answer.`
      : null;

  return [
    "## Runtime Context",
    `Today is ${formatDateOnly(now)} in Asia/Seoul.`,
    "Published songs listed in official context are already released unless explicitly marked upcoming.",
    outputRule,
    "If the user asks for a longer answer, keep the same concise style instead of expanding past the limits.",
  ].filter(Boolean).join("\n");
}

async function loadLiveContext(deps: BuildDeps): Promise<OfficialLiveContextItem[]> {
  if (deps.getUpcomingEvents) {
    const events = await deps.getUpcomingEvents();
    return events.map((item) => ({
      eventDate: formatLiveDateFallback(item.eventDate),
      venue: item.venue,
      city: item.city,
      ticketUrl: item.ticketUrl,
      videoUrl: item.videoUrl,
    }));
  }

  const liveModule = getModuleExports(await import("./live")) as ModuleExports<typeof import("./live")>;
  const events = await liveModule.getUpcomingEvents();
  return events.map((item) => ({
    eventDate: liveModule.formatLiveDateWithYear(item.eventDate),
    venue: item.venue,
    city: item.city,
    ticketUrl: item.ticketUrl,
    videoUrl: item.videoUrl,
  }));
}

async function loadMemberContext(deps: BuildDeps): Promise<OfficialMemberContextItem[]> {
  if (deps.getPublishedMembers) {
    const members = await deps.getPublishedMembers();
    return members.map((item) => ({
      nameKr: item.nameKr,
      nameEn: item.nameEn,
      position: item.position,
      favoriteArtist: item.favoriteArtist,
      favoriteSong: item.favoriteSong,
    }));
  }

  const membersModule = getModuleExports(await import("./members")) as ModuleExports<typeof import("./members")>;
  const getPublishedMembers = deps.getPublishedMembers ?? membersModule.getPublishedMembers;
  const members = await getPublishedMembers();
  return members.map((item) => ({
    nameKr: item.nameKr,
    nameEn: item.nameEn,
    position: item.position,
    favoriteArtist: item.favoriteArtist,
    favoriteSong: item.favoriteSong,
  }));
}

async function loadSongContext(deps: BuildDeps): Promise<OfficialSongContextItem[]> {
  if (deps.getPublishedSongs) {
    const songs = await deps.getPublishedSongs();
    return songs.map((item) => ({
      title: item.title,
      category: item.category,
      releasedAt: formatDateOnly(item.releasedAt),
      listenUrl: item.listenUrl,
    }));
  }

  const songsModule = getModuleExports(await import("./songs")) as ModuleExports<typeof import("./songs")>;
  const getPublishedSongs = deps.getPublishedSongs ?? songsModule.getPublishedSongs;
  const songs = await getPublishedSongs();
  return songs.map((item) => ({
    title: item.title,
    category: item.category,
    releasedAt: formatDateOnly(item.releasedAt),
    listenUrl: item.listenUrl,
  }));
}

async function loadNewsContext(deps: BuildDeps): Promise<OfficialNewsContextItem[]> {
  if (deps.getPublishedNews) {
    const news = await deps.getPublishedNews();
    return news.map((item) => ({
      headline: item.headline,
      date: formatNewsDateFallback(item.date),
      category: item.category,
      summary: excerptFallback(item.body, 90),
    }));
  }

  const newsModule = getModuleExports(await import("./news")) as typeof import("./news");
  const news = await newsModule.getPublishedNews();
  return news.map((item) => ({
    headline: item.headline,
    date: newsModule.formatNewsDate(item.date),
    category: item.category,
    summary: newsModule.excerpt(item.body, 90),
  }));
}

export async function buildYeongminOfficialContext(
  message: string,
  deps: BuildDeps = {},
): Promise<string | null> {
  const needs = classifyOfficialContextNeeds(message);
  let membersForNameMatch: OfficialMemberContextItem[] | null = null;

  if (!needs.members) {
    membersForNameMatch = await loadMemberContext(deps);
    if (messageMentionsMemberName(message, membersForNameMatch)) {
      needs.members = true;
    }
  }

  if (!needs.live && !needs.members && !needs.songs && !needs.news) {
    return null;
  }

  const [live, members, songs, news] = await Promise.all([
    needs.live ? loadLiveContext(deps) : Promise.resolve([]),
    needs.members
      ? Promise.resolve(membersForNameMatch ?? null).then((items) => items ?? loadMemberContext(deps))
      : Promise.resolve([]),
    needs.songs ? loadSongContext(deps) : Promise.resolve([]),
    needs.news ? loadNewsContext(deps) : Promise.resolve([]),
  ]);

  return formatOfficialContext({ live, members, songs, news });
}
