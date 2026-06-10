const USERNAME_RE = /^[a-z0-9._]{1,30}$/;
const ALLOWED_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

export function normalizeUsername(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      return null;
    }
    if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    s = parts[0] === "_u" ? (parts[1] ?? "") : parts[0];
  }
  s = s.replace(/^@/, "").split("?")[0].replace(/\//g, "").trim().toLowerCase();
  return USERNAME_RE.test(s) ? s : null;
}

export function toProfileUrl(username: string): string {
  return `https://www.instagram.com/${username}/`;
}
