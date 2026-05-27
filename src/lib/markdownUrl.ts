// Whitelist transform for markdown link/image URLs. Returns "" to drop the URL.
// Shared by the public <Markdown> renderer and the editor preview.
const SAFE_SCHEMES = ["http:", "https:", "mailto:"];

export function sanitizeMarkdownUrl(url: string): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/") || raw.startsWith("#")) return raw;
  const m = raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)/);
  if (!m) return raw; // bare relative path (no scheme) — safe
  return SAFE_SCHEMES.includes(m[1].toLowerCase()) ? raw : "";
}
