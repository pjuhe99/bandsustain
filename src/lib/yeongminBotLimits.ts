export type OutputLimitOptions = {
  outputMaxChars: number;
  outputMaxLines: number;
};

export function isInputTooLong(input: string, inputCharLimit: number): boolean {
  return input.length > inputCharLimit;
}

export function clampReply(reply: string, options: OutputLimitOptions): string {
  const trimmed = reply.trim();
  const lines = trimmed.split("\n").slice(0, Math.max(1, options.outputMaxLines));
  const byLines = lines.join("\n");
  return byLines.slice(0, Math.max(1, options.outputMaxChars)).trimEnd();
}
