import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import {
  getSettings,
  getDecryptedApiKey,
  assemblePrompt,
  insertUsageLog,
  countSessionMessagesLast24h,
  sumTodayTokens,
  calcCostUsd,
} from "@/lib/yeongminBot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "bs_yeongmin_sid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const FALLBACK_SESSION_CAP =
  "아\n오늘은 너랑 좀 떠들었네\n내일 또 와라";
const FALLBACK_DAILY_CAP =
  "흠\n오늘 다 같이 너무 떠들었는지\n머리가 좀 식어야겠다\n내일 보자";
const FALLBACK_OPENAI_ERROR =
  "아\n잠깐 어디 잡혀갔다 왔다\n한 번 더 물어봐";
const FALLBACK_NOT_CONFIGURED =
  "아\n지금은 내가 잠깐 자리 비웠다\n관리자가 깨워주면 다시 옴";

type ChatMessage = { role: "user" | "assistant"; content: string };

function isChatMessage(v: unknown): v is ChatMessage {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    (o.role === "user" || o.role === "assistant") &&
    typeof o.content === "string" &&
    o.content.length >= 1 &&
    o.content.length <= 2000
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const messages = (body as { messages?: unknown }).messages;
  if (
    !Array.isArray(messages) ||
    messages.length < 1 ||
    messages.length > 64 ||
    !messages.every(isChatMessage) ||
    messages[messages.length - 1].role !== "user"
  ) {
    return NextResponse.json({ error: "invalid messages" }, { status: 400 });
  }
  const history = messages as ChatMessage[];

  // Session cookie
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(COOKIE_NAME)?.value;
  const isNewSession = !sessionId;
  if (!sessionId) sessionId = randomUUID();

  // Load settings (must include API key for real call)
  let settings;
  try {
    settings = await getSettings();
  } catch {
    return replyJson(
      FALLBACK_NOT_CONFIGURED,
      sessionId,
      isNewSession,
      0,
      true,
      false,
    );
  }
  if (!settings.apiKeyEncrypted) {
    return replyJson(
      FALLBACK_NOT_CONFIGURED,
      sessionId,
      isNewSession,
      0,
      true,
      false,
    );
  }

  // Session cap (rolling 24h)
  const sessionCount = await countSessionMessagesLast24h(sessionId);
  if (sessionCount >= settings.sessionMsgCap) {
    return replyJson(
      FALLBACK_SESSION_CAP,
      sessionId,
      isNewSession,
      0,
      false,
      true,
    );
  }

  // Daily token cap
  const todayTokens = await sumTodayTokens();
  if (todayTokens >= settings.dailyTokenCap) {
    return replyJson(
      FALLBACK_DAILY_CAP,
      sessionId,
      isNewSession,
      settings.sessionMsgCap - sessionCount,
      true,
      false,
    );
  }

  // OpenAI call
  let apiKey: string;
  try {
    apiKey = getDecryptedApiKey(settings);
  } catch {
    return replyJson(
      FALLBACK_NOT_CONFIGURED,
      sessionId,
      isNewSession,
      0,
      true,
      false,
    );
  }

  const client = new OpenAI({ apiKey, timeout: 45_000 });
  const systemPrompt = assemblePrompt(settings);

  try {
    const completion = await client.chat.completions.create({
      model: settings.modelName,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
      ],
      temperature: 0.9,
      max_tokens: 800,
    });
    const reply =
      completion.choices[0]?.message?.content?.trim() ?? FALLBACK_OPENAI_ERROR;
    const usage = completion.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
    const inputTokens = usage.prompt_tokens ?? 0;
    const outputTokens = usage.completion_tokens ?? 0;
    const costUsd = calcCostUsd(
      inputTokens,
      outputTokens,
      settings.inputRatePer1mUsd,
      settings.outputRatePer1mUsd,
    );
    await insertUsageLog({
      sessionId,
      inputTokens,
      outputTokens,
      modelName: settings.modelName,
      costUsd,
    });
    const remaining = settings.sessionMsgCap - (sessionCount + 1);
    return replyJson(
      reply,
      sessionId,
      isNewSession,
      Math.max(remaining, 0),
      false,
      false,
    );
  } catch (err) {
    console.error("[yeongmin-bot] OpenAI error:", err);
    return replyJson(
      FALLBACK_OPENAI_ERROR,
      sessionId,
      isNewSession,
      Math.max(settings.sessionMsgCap - sessionCount, 0),
      false,
      false,
    );
  }
}

function replyJson(
  reply: string,
  sessionId: string,
  setCookie: boolean,
  sessionRemaining: number,
  dailyLimitReached: boolean,
  sessionLimitReached: boolean,
) {
  const res = NextResponse.json({
    reply,
    sessionRemaining,
    dailyLimitReached,
    sessionLimitReached,
  });
  if (setCookie) {
    res.cookies.set(COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
  }
  return res;
}
