import { NextResponse } from "next/server";
import { z } from "zod";
import { isInstagramFollowEnabled } from "@/lib/playground/instagram/flag";
import { HOF_PAGE_SIZE, MIN_FOLLOW_DATE } from "@/lib/playground/instagram/config";
import { validateNickname } from "@/lib/playground/instagram/nickname";
import { followDayCount } from "@/lib/playground/instagram/followDays";
import { extractClientIp, hashIp, hashBrowserToken } from "@/lib/playground/instagram/ipHash";
import { createRateLimiter } from "@/lib/playground/instagram/rateLimit";
import { insertHof, listVisibleHof } from "@/lib/playground/instagram/hofDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 동일 IP 10분 5회
const allowPost = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(HOF_PAGE_SIZE),
});

const BodySchema = z.object({
  nickname: z.string().min(1).max(100),
  sustainFollowedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  browserToken: z.string().max(128).optional(),
  agreedToPolicy: z.literal(true),
});

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetch는 Origin이 없을 수 있음
  const host = req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!isInstagramFollowEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_query" }, { status: 400 });
  }
  const { page, pageSize } = parsed.data;
  const { items, total } = await listVisibleHof(page, pageSize);
  const offset = (page - 1) * pageSize;
  return NextResponse.json({
    items: items.map((it, i) => ({
      rank: offset + i + 1,
      nickname: it.nickname,
      followedAt: it.followedAt,
      daysFollowing: followDayCount(it.followedAt) ?? 0,
    })),
    total,
    page,
    pageSize,
  });
}

export async function POST(req: Request) {
  if (!isInstagramFollowEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const ip = extractClientIp(req);
  if (!allowPost(ip)) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "입력값을 확인해 주세요." },
      { status: 400 },
    );
  }

  const nick = validateNickname(parsed.data.nickname);
  if (!nick.ok) {
    return NextResponse.json({ code: "BAD_NICKNAME", message: nick.reason }, { status: 400 });
  }

  // 날짜 검증: 미래 금지, 인스타그램 출시(2010-10-01) 이전 금지
  const date = parsed.data.sustainFollowedAt;
  const days = followDayCount(date); // 미래/비정상 날짜면 null
  if (days === null || date < MIN_FOLLOW_DATE) {
    return NextResponse.json(
      { code: "BAD_DATE", message: "팔로우 시작일이 올바르지 않아요." },
      { status: 400 },
    );
  }

  const result = await insertHof({
    nickname: nick.value,
    sustainFollowedAt: date,
    ipHash: hashIp(ip),
    browserTokenHash: parsed.data.browserToken ? hashBrowserToken(parsed.data.browserToken) : null,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        code: "DUPLICATE_ENTRY",
        message: "이미 같은 환경과 팔로우 날짜로 등록된 기록이 있어요.",
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
