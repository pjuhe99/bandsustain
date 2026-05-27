// Whitelist transform for markdown link/image URLs. Returns "" to drop the URL.
// Shared by the public <Markdown> renderer and the editor preview.
const SAFE_SCHEMES = ["http:", "https:", "mailto:"];

// ASCII control chars (codes < 32 and DEL=127) can smuggle a dangerous scheme
// past the scheme regex, e.g. a tab inside "java<TAB>script:alert(1)". Drop them
// before any matching. Done via char codes to avoid control-char regex literals.
function stripControlChars(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code !== 127) out += ch;
  }
  return out;
}

export function sanitizeMarkdownUrl(url: string): string {
  const raw = stripControlChars(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/") || raw.startsWith("#")) return raw;
  const m = raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)/);
  if (!m) {
    // No clean scheme matched. If a ":" still appears before any path/query/hash
    // separator, it is an obfuscated/malformed scheme (e.g. "java script:...") - drop it.
    // Otherwise it is a genuine relative path.
    const colon = raw.indexOf(":");
    if (colon !== -1 && !/[/?#]/.test(raw.slice(0, colon))) return "";
    return raw;
  }
  return SAFE_SCHEMES.includes(m[1].toLowerCase()) ? raw : "";
}
