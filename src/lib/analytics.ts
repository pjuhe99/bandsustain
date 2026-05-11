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

function todayYYYYMMDD(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function visitorHash(ip: string, ua: string): string {
  return crypto
    .createHash("sha256")
    .update(`${ip}|${ua}|${todayYYYYMMDD()}|${getAnalyticsSecret()}`)
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

  await getPool().query(
    `INSERT INTO analytics_events (path, referrer, ref_host, visitor_hash, is_bot, country)
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
