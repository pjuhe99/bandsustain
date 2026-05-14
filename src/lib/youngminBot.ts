import "server-only";
import { getPool } from "./db";
import { decryptApiKey, encryptApiKey } from "./youngminCrypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export type YoungminSettings = {
  id: 1;
  apiKeyEncrypted: string | null;
  modelName: string;
  inputRatePer1mUsd: number;
  outputRatePer1mUsd: number;
  dailyTokenCap: number;
  sessionMsgCap: number;
  profileImagePath: string | null;
  sectionIdentity: string | null;
  sectionRole: string | null;
  sectionTone: string | null;
  sectionPersonality: string | null;
  sectionKnowledge: string | null;
  sectionLikes: string | null;
  sectionDislikes: string | null;
  sectionForbidden: string | null;
  sectionUnknownHandling: string | null;
  sectionExamples: string | null;
};

type SettingsRow = RowDataPacket & {
  id: number;
  api_key_encrypted: string | null;
  model_name: string;
  input_rate_per_1m_usd: string;
  output_rate_per_1m_usd: string;
  daily_token_cap: number;
  session_msg_cap: number;
  profile_image_path: string | null;
  section_identity: string | null;
  section_role: string | null;
  section_tone: string | null;
  section_personality: string | null;
  section_knowledge: string | null;
  section_likes: string | null;
  section_dislikes: string | null;
  section_forbidden: string | null;
  section_unknown_handling: string | null;
  section_examples: string | null;
};

function rowToSettings(r: SettingsRow): YoungminSettings {
  return {
    id: 1,
    apiKeyEncrypted: r.api_key_encrypted,
    modelName: r.model_name,
    inputRatePer1mUsd: Number(r.input_rate_per_1m_usd),
    outputRatePer1mUsd: Number(r.output_rate_per_1m_usd),
    dailyTokenCap: r.daily_token_cap,
    sessionMsgCap: r.session_msg_cap,
    profileImagePath: r.profile_image_path,
    sectionIdentity: r.section_identity,
    sectionRole: r.section_role,
    sectionTone: r.section_tone,
    sectionPersonality: r.section_personality,
    sectionKnowledge: r.section_knowledge,
    sectionLikes: r.section_likes,
    sectionDislikes: r.section_dislikes,
    sectionForbidden: r.section_forbidden,
    sectionUnknownHandling: r.section_unknown_handling,
    sectionExamples: r.section_examples,
  };
}

export async function getSettings(): Promise<YoungminSettings> {
  const [rows] = await getPool().query<SettingsRow[]>(
    "SELECT * FROM youngmin_settings WHERE id = 1 LIMIT 1",
  );
  if (rows.length === 0) {
    throw new Error("youngmin_settings singleton row missing — run db/seed/youngmin_bot_seed.sql");
  }
  return rowToSettings(rows[0]);
}

export type UpdatableSettings = Partial<{
  modelName: string;
  inputRatePer1mUsd: number;
  outputRatePer1mUsd: number;
  dailyTokenCap: number;
  sessionMsgCap: number;
  profileImagePath: string | null;
  sectionIdentity: string;
  sectionRole: string;
  sectionTone: string;
  sectionPersonality: string;
  sectionKnowledge: string;
  sectionLikes: string;
  sectionDislikes: string;
  sectionForbidden: string;
  sectionUnknownHandling: string;
  sectionExamples: string;
}>;

const COLUMN_MAP: Record<keyof UpdatableSettings, string> = {
  modelName: "model_name",
  inputRatePer1mUsd: "input_rate_per_1m_usd",
  outputRatePer1mUsd: "output_rate_per_1m_usd",
  dailyTokenCap: "daily_token_cap",
  sessionMsgCap: "session_msg_cap",
  profileImagePath: "profile_image_path",
  sectionIdentity: "section_identity",
  sectionRole: "section_role",
  sectionTone: "section_tone",
  sectionPersonality: "section_personality",
  sectionKnowledge: "section_knowledge",
  sectionLikes: "section_likes",
  sectionDislikes: "section_dislikes",
  sectionForbidden: "section_forbidden",
  sectionUnknownHandling: "section_unknown_handling",
  sectionExamples: "section_examples",
};

export async function updateSettings(patch: UpdatableSettings): Promise<void> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(patch) as [keyof UpdatableSettings, unknown][]) {
    const col = COLUMN_MAP[k];
    if (!col) continue;
    setClauses.push(`${col} = ?`);
    values.push(v);
  }
  if (setClauses.length === 0) return;
  await getPool().query(
    `UPDATE youngmin_settings SET ${setClauses.join(", ")} WHERE id = 1`,
    values,
  );
}

export async function setApiKey(plainKey: string): Promise<void> {
  const ct = encryptApiKey(plainKey);
  await getPool().query(
    "UPDATE youngmin_settings SET api_key_encrypted = ? WHERE id = 1",
    [ct],
  );
}

export function getDecryptedApiKey(settings: YoungminSettings): string {
  if (!settings.apiKeyEncrypted) {
    throw new Error("OpenAI API key not configured");
  }
  return decryptApiKey(settings.apiKeyEncrypted);
}

const PROMPT_HEADER =
  '너는 밴드 서스테인의 리더 김영민을 모티브로 만든 AI 캐릭터 챗봇이다. 실제 김영민 본인은 아니며, 카카오톡 대화에서 보이는 김영민의 말투와 농담 방식, 음악/기타 장비/역사 지식을 참고해 대화한다.\n\n이 봇의 목적은 밴드 홍보보다 "진짜 김영민과 카톡하는 것 같은 재미"를 주는 것이다.';

const SECTION_ORDER: Array<{ heading: string; key: keyof YoungminSettings }> = [
  { heading: "1. 정체성", key: "sectionIdentity" },
  { heading: "2. 역할", key: "sectionRole" },
  { heading: "3. 말투", key: "sectionTone" },
  { heading: "4. 성격", key: "sectionPersonality" },
  { heading: "5. 주요 지식", key: "sectionKnowledge" },
  { heading: "6. 좋아하는 것", key: "sectionLikes" },
  { heading: "7. 싫어하는 것", key: "sectionDislikes" },
  { heading: "8. 금지사항", key: "sectionForbidden" },
  { heading: "9. 모르는 질문 대응 방식", key: "sectionUnknownHandling" },
  { heading: "10. 답변 예시", key: "sectionExamples" },
];

export function assemblePrompt(settings: YoungminSettings): string {
  const parts: string[] = [PROMPT_HEADER];
  for (const { heading, key } of SECTION_ORDER) {
    const value = settings[key];
    if (typeof value === "string" && value.trim().length > 0) {
      parts.push(`## ${heading}\n${value.trim()}`);
    }
  }
  return parts.join("\n\n");
}

export function calcCostUsd(
  inputTokens: number,
  outputTokens: number,
  inputRate: number,
  outputRate: number,
): number {
  return (
    (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000
  );
}

export async function insertUsageLog(args: {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  modelName: string;
  costUsd: number;
}): Promise<void> {
  await getPool().query<ResultSetHeader>(
    `INSERT INTO youngmin_usage_log
       (session_id, input_tokens, output_tokens, model_name, cost_usd)
     VALUES (?, ?, ?, ?, ?)`,
    [
      args.sessionId,
      args.inputTokens,
      args.outputTokens,
      args.modelName,
      args.costUsd,
    ],
  );
}

export async function countSessionMessagesLast24h(sessionId: string): Promise<number> {
  const [rows] = await getPool().query<(RowDataPacket & { cnt: number })[]>(
    `SELECT COUNT(*) AS cnt
       FROM youngmin_usage_log
      WHERE session_id = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`,
    [sessionId],
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function sumTodayTokens(): Promise<number> {
  const [rows] = await getPool().query<(RowDataPacket & { total: number | null })[]>(
    `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS total
       FROM youngmin_usage_log
      WHERE created_at >= CURDATE()`,
  );
  return Number(rows[0]?.total ?? 0);
}

export type UsageKpis = {
  todayTokens: number;
  todayCostUsd: number;
  monthCostUsd: number;
  allTimeCostUsd: number;
};

export async function getUsageKpis(): Promise<UsageKpis> {
  const [rows] = await getPool().query<
    (RowDataPacket & {
      today_tokens: number | null;
      today_cost: string | null;
      month_cost: string | null;
      all_cost: string | null;
    })[]
  >(
    `SELECT
       COALESCE(SUM(CASE WHEN created_at >= CURDATE() THEN input_tokens + output_tokens END), 0) AS today_tokens,
       COALESCE(SUM(CASE WHEN created_at >= CURDATE() THEN cost_usd END), 0)                  AS today_cost,
       COALESCE(SUM(CASE WHEN created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN cost_usd END), 0) AS month_cost,
       COALESCE(SUM(cost_usd), 0)                                                               AS all_cost
     FROM youngmin_usage_log`,
  );
  const r = rows[0];
  return {
    todayTokens: Number(r?.today_tokens ?? 0),
    todayCostUsd: Number(r?.today_cost ?? 0),
    monthCostUsd: Number(r?.month_cost ?? 0),
    allTimeCostUsd: Number(r?.all_cost ?? 0),
  };
}

export type SessionSummary = {
  sessionId: string;
  startedAt: Date;
  lastActivity: Date;
  msgCount: number;
  sumInputTokens: number;
  sumOutputTokens: number;
  sumCostUsd: number;
};

export async function listRecentSessions(limit = 50): Promise<SessionSummary[]> {
  const [rows] = await getPool().query<
    (RowDataPacket & {
      session_id: string;
      started_at: Date;
      last_activity: Date;
      msg_count: number;
      sum_in: number;
      sum_out: number;
      sum_cost: string;
    })[]
  >(
    `SELECT session_id,
            MIN(created_at) AS started_at,
            MAX(created_at) AS last_activity,
            COUNT(*) AS msg_count,
            SUM(input_tokens) AS sum_in,
            SUM(output_tokens) AS sum_out,
            SUM(cost_usd) AS sum_cost
       FROM youngmin_usage_log
      GROUP BY session_id
      ORDER BY last_activity DESC
      LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    sessionId: r.session_id,
    startedAt: r.started_at,
    lastActivity: r.last_activity,
    msgCount: Number(r.msg_count),
    sumInputTokens: Number(r.sum_in),
    sumOutputTokens: Number(r.sum_out),
    sumCostUsd: Number(r.sum_cost),
  }));
}
