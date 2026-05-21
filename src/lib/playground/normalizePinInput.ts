/**
 * Trim + collapse newlines for member-pin override_title / caption inputs.
 * Returns null when the result is empty so the caller can store SQL NULL
 * (which lets the gallery fall back to layout.title for missing override).
 *
 * Note: only newlines are collapsed to a single space — internal
 * consecutive spaces are preserved (admin's choice, not noise).
 */
export function normalizePinInput(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const collapsed = raw.replace(/(?:\r\n|\r|\n)+/g, " ");
  const trimmed = collapsed.trim();
  return trimmed.length === 0 ? null : trimmed;
}
