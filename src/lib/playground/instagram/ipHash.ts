import "server-only";
import { createHmac } from "node:crypto";
import { requireCred } from "@/lib/creds";

export function normalizeIp(raw: string): string {
  let ip = raw.trim().toLowerCase();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7); // IPv4-mapped IPv6
  return ip;
}

// Apache mod_proxy 는 클라이언트가 보낸 XFF 뒤에 실제 접속 IP 를 append 한다.
// 첫 항목은 위조 가능하므로 마지막 항목(우리 프록시가 붙인 값)을 신뢰한다.
export function extractClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const last = xff.split(",").pop()?.trim() ?? "";
  const raw = last || (req.headers.get("x-real-ip") ?? "").trim() || "0.0.0.0";
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
