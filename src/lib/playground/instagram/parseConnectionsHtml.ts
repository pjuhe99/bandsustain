import { normalizeUsername, toProfileUrl } from "./normalizeUsername";
import { parseInstagramDate } from "./parseInstagramDate";
import type { InstagramConnection, ParseOutcome } from "./types";

const ANCHOR_RE =
  /<a\b[^>]*href="(https?:\/\/(?:www\.)?instagram\.com\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

// 프로필이 아닌 인스타그램 경로 (게시물/릴스 등)
const RESERVED = new Set([
  "p", "reel", "reels", "stories", "explore", "accounts", "direct",
]);

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

export function parseConnectionsHtml(html: string): ParseOutcome {
  const seen = new Map<string, InstagramConnection>();
  let failedCount = 0;

  for (const m of html.matchAll(ANCHOR_RE)) {
    const href = m[1];
    const firstSeg =
      href.split("instagram.com/")[1]?.split(/[/?]/)[0]?.toLowerCase() ?? "";
    if (RESERVED.has(firstSeg)) continue;

    const linkText = decodeEntities(m[2].replace(/<[^>]*>/g, "")).trim();
    const username = normalizeUsername(href) ?? normalizeUsername(linkText);
    if (!username) {
      failedCount++;
      continue;
    }

    // <a> 닫힌 직후 ~300자 내 첫 <div>텍스트</div> = 팔로우 날짜 (실측 마크업 근거)
    const tail = html.slice(
      m.index! + m[0].length,
      m.index! + m[0].length + 300,
    );
    const dm = tail.match(/<div>([^<>]{4,80})<\/div>/);
    const followedAtRaw = dm ? decodeEntities(dm[1]).trim() : null;
    const followedAt = followedAtRaw ? parseInstagramDate(followedAtRaw) : null;

    if (!seen.has(username)) {
      seen.set(username, {
        username,
        profileUrl: toProfileUrl(username),
        followedAt,
        followedAtRaw,
      });
    }
  }

  return { connections: [...seen.values()], failedCount };
}
