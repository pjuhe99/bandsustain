import "server-only";
import crypto from "node:crypto";
import { getPool } from "./db";
import { loadCreds } from "./creds";

const BOT_PATTERNS: RegExp[] = [
  /bot\b/i,
  /spider/i,
  /crawler/i,
  /facebookexternalhit/i,
  /slurp/i,
  /yandex/i,
  /baiduspider/i,
  /yeti/i,
  /naverbot/i,
  /duckduckbot/i,
  /lighthouse/i,
  /headlesschrome/i,
  /puppeteer/i,
  /chatgpt/i,
  /perplexity/i,
  /claudebot/i,
  /gptbot/i,
  /uptimerobot/i,
  /pingdom/i,
  /applebot/i,
  /ahrefs/i,
  /semrush/i,
  /mj12bot/i,
];

export function isBot(ua: string): boolean {
  if (!ua || ua.length < 5) return true;
  return BOT_PATTERNS.some((p) => p.test(ua));
}

let cachedSecret: string | null = null;
function getAnalyticsSecret(): string {
  if (cachedSecret) return cachedSecret;
  const c = loadCreds();
  cachedSecret = c.ANALYTICS_SECRET || "fallback-dev-not-for-prod";
  return cachedSecret;
}

// 월 회전 솔트: 한 달 안에서는 같은 사람이 같은 신원 → cross-day unique
// 카운트가 정확. 매월 1일 자정에 신원이 새로 생성되어 영구 추적은 불가
// (PIPA 보수적). cross-month 윈도우는 같은 사람이 2번 카운트될 수 있음.
function thisMonthYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function visitorHash(ip: string, ua: string): string {
  return crypto
    .createHash("sha256")
    .update(`${ip}|${ua}|${thisMonthYYYYMM()}|${getAnalyticsSecret()}`)
    .digest("hex")
    .slice(0, 16);
}

function extractRefHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.hostname === "bandsustain.com" || url.hostname === "www.bandsustain.com") return null;
    return url.hostname;
  } catch {
    return null;
  }
}

type LogInput = {
  path: string;
  ua: string;
  ip: string;
  referrer: string | null;
  country?: string | null;
};

export async function logPageView(input: LogInput): Promise<void> {
  if (isBot(input.ua)) return;

  const hash = visitorHash(input.ip || "0.0.0.0", input.ua);
  const refHost = extractRefHost(input.referrer);

  // INSERT IGNORE relies on UNIQUE(visitor_hash, path, bucket_5m) to drop
  // same-visitor + same-path hits within a 5-minute bucket → absorbs
  // prefetch leakage (Apache mod_security strips Next-Router-Prefetch
  // header) and refresh-spam. Real follow-up visits (>5min apart) still
  // count.
  await getPool().query(
    `INSERT IGNORE INTO analytics_events
       (path, referrer, ref_host, visitor_hash, is_bot, country)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [
      input.path.slice(0, 255),
      input.referrer ? input.referrer.slice(0, 500) : null,
      refHost ? refHost.slice(0, 100) : null,
      hash,
      input.country ? input.country.slice(0, 2) : null,
    ],
  );
}
