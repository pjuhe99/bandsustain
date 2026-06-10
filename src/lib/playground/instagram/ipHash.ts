import "server-only";
import { createHmac } from "node:crypto";
import { requireCred } from "@/lib/creds";

export function normalizeIp(raw: string): string {
  let ip = raw.trim().toLowerCase();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7); // IPv4-mapped IPv6
  return ip;
}

// 기존 analytics 라우트와 동일 추출 방식 (Apache 리버스 프록시 전제)
export function extractClientIp(req: Request): string {
  const raw =
    (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "")
      .split(",")[0]
      .trim() || "0.0.0.0";
  return normalizeIp(raw);
}

// 원본 IP는 저장하지 않는다. 서버 비밀키 HMAC만 저장.
export function hashIp(ip: string): string {
  return createHmac("sha256", requireCred("INSTAGRAM_HOF_SECRET"))
    .update(normalizeIp(ip))
    .digest("hex");
}

export function hashBrowserToken(token: string): string {
  return createHmac("sha256", requireCred("INSTAGRAM_HOF_SECRET"))
    .update(`bt:${token}`)
    .digest("hex");
}
