import { clampReply, type OutputLimitOptions } from "./yeongminBotLimits";

export function selectCapFallbackReply(
  adminValue: string | null | undefined,
  hardcodedDefault: string,
  limits: OutputLimitOptions,
): string {
  const trimmed = typeof adminValue === "string" ? adminValue.trim() : "";
  const chosen = trimmed.length > 0 ? trimmed : hardcodedDefault;
  return clampReply(chosen, limits);
}
