import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import {
  assertValidVoiceCorpusJson,
  getSettings,
  updateSettings,
  type UpdatableSettings,
} from "@/lib/yeongminBot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRING_KEYS = new Set<keyof UpdatableSettings>([
  "modelName",
  "longInputFallbackReply",
  "sessionCapFallbackReply",
  "dailyCapFallbackReply",
  "sectionIdentity",
  "sectionRole",
  "sectionTone",
  "sectionPersonality",
  "sectionKnowledge",
  "sectionLikes",
  "sectionDislikes",
  "sectionForbidden",
  "sectionUnknownHandling",
  "sectionExamples",
  "sectionUserAddress",
  "voiceCorpusJson",
]);

const NUMBER_KEYS = new Set<keyof UpdatableSettings>([
  "inputRatePer1mUsd",
  "outputRatePer1mUsd",
  "dailyTokenCap",
  "sessionMsgCap",
  "inputCharLimit",
  "outputMaxChars",
  "outputMaxLines",
  "outputMaxTokens",
]);

const POSITIVE_NUMBER_KEYS = new Set<keyof UpdatableSettings>([
  "inputCharLimit",
  "outputMaxChars",
  "outputMaxLines",
  "outputMaxTokens",
]);

const NULLABLE_STRING_KEYS = new Set<keyof UpdatableSettings>(["profileImagePath"]);

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = await getSettings();
  return NextResponse.json({
    modelName: s.modelName,
    inputRatePer1mUsd: s.inputRatePer1mUsd,
    outputRatePer1mUsd: s.outputRatePer1mUsd,
    dailyTokenCap: s.dailyTokenCap,
    sessionMsgCap: s.sessionMsgCap,
    inputCharLimit: s.inputCharLimit,
    longInputFallbackReply: s.longInputFallbackReply,
    sessionCapFallbackReply: s.sessionCapFallbackReply,
    dailyCapFallbackReply: s.dailyCapFallbackReply,
    outputMaxChars: s.outputMaxChars,
    outputMaxLines: s.outputMaxLines,
    outputMaxTokens: s.outputMaxTokens,
    profileImagePath: s.profileImagePath,
    apiKeyConfigured: Boolean(s.apiKeyEncrypted),
    sectionIdentity: s.sectionIdentity,
    sectionRole: s.sectionRole,
    sectionTone: s.sectionTone,
    sectionPersonality: s.sectionPersonality,
    sectionKnowledge: s.sectionKnowledge,
    sectionLikes: s.sectionLikes,
    sectionDislikes: s.sectionDislikes,
    sectionForbidden: s.sectionForbidden,
    sectionUnknownHandling: s.sectionUnknownHandling,
    sectionExamples: s.sectionExamples,
    sectionUserAddress: s.sectionUserAddress,
    voiceCorpusJson: s.voiceCorpusJson,
  });
}

export async function PATCH(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const patch: UpdatableSettings = {};
  for (const [k, v] of Object.entries(body)) {
    if (STRING_KEYS.has(k as keyof UpdatableSettings)) {
      if (typeof v !== "string") {
        return NextResponse.json({ error: `${k} must be string` }, { status: 400 });
      }
      if (k === "voiceCorpusJson") {
        try {
          assertValidVoiceCorpusJson(v);
        } catch (error) {
          const message = error instanceof Error ? error.message : "invalid voiceCorpusJson";
          return NextResponse.json({ error: message }, { status: 400 });
        }
      }
      (patch as Record<string, unknown>)[k] = v;
    } else if (NUMBER_KEYS.has(k as keyof UpdatableSettings)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: `${k} must be non-negative number` }, { status: 400 });
      }
      if (POSITIVE_NUMBER_KEYS.has(k as keyof UpdatableSettings) && n < 1) {
        return NextResponse.json({ error: `${k} must be positive number` }, { status: 400 });
      }
      (patch as Record<string, unknown>)[k] = n;
    } else if (NULLABLE_STRING_KEYS.has(k as keyof UpdatableSettings)) {
      if (v !== null && typeof v !== "string") {
        return NextResponse.json({ error: `${k} must be string or null` }, { status: 400 });
      }
      (patch as Record<string, unknown>)[k] = v;
    }
  }

  await updateSettings(patch);
  return NextResponse.json({ ok: true });
}
