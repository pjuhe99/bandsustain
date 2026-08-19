import "server-only";
import type { ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";

type RebirthUsageOutcome = "cache_hit" | "generated" | "incomplete";

const MODEL_PRICING_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  // https://platform.openai.com/pricing (checked 2026-08-19)
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
};

export type RebirthTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

function tokenCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function readRebirthTokenUsage(response: { usage?: unknown }): RebirthTokenUsage {
  const usage = response.usage as {
    input_tokens?: unknown;
    output_tokens?: unknown;
    total_tokens?: unknown;
  } | undefined;
  const inputTokens = tokenCount(usage?.input_tokens);
  const outputTokens = tokenCount(usage?.output_tokens);
  const reportedTotal = tokenCount(usage?.total_tokens);
  return {
    inputTokens,
    outputTokens,
    totalTokens: reportedTotal || inputTokens + outputTokens,
  };
}

function estimateCostUsd(modelName: string | null, usage: RebirthTokenUsage) {
  if (!modelName) return null;
  const pricing = MODEL_PRICING_USD_PER_MILLION[modelName];
  if (!pricing) return null;
  return (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) / 1_000_000;
}

export async function insertRebirthUsageLog(args: {
  seed: string;
  outcome: RebirthUsageOutcome;
  attempt: number;
  modelName: string | null;
  usage?: RebirthTokenUsage;
}): Promise<void> {
  const usage = args.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  await getPool().query<ResultSetHeader>(
    `INSERT INTO rebirth_usage_log
       (seed, outcome, attempt, model_name, input_tokens, output_tokens, total_tokens, estimated_cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      args.seed,
      args.outcome,
      args.attempt,
      args.modelName,
      usage.inputTokens,
      usage.outputTokens,
      usage.totalTokens,
      estimateCostUsd(args.modelName, usage),
    ],
  );
}
