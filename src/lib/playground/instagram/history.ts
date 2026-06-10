import type { AnalysisResult } from "./types";

const KEY = "bs_instagram_follow_history_v1";
const TOKEN_KEY = "bs_instagram_follow_token_v1";
const REGISTERED_KEY = "bs_instagram_follow_registered_v1";
const MAX_ITEMS = 10;

export type HistoryEntry = {
  analyzedAt: string;
  followerCount: number;
  followingCount: number;
  notFollowingMeBackCount: number;
  sustainFollowing: boolean;
};

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(r: AnalysisResult): void {
  const entry: HistoryEntry = {
    analyzedAt: r.analyzedAt,
    followerCount: r.relations.followers.length,
    followingCount: r.relations.following.length,
    notFollowingMeBackCount: r.relations.notFollowingMeBack.length,
    sustainFollowing: r.sustain.following,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...loadHistory()].slice(0, MAX_ITEMS)));
  } catch {
    /* storage 불가 환경은 무시 */
  }
}

// 명예의 전당 보조 중복 안내용 (보조 수단)
export function getOrCreateBrowserToken(): string {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch {
    return "no-storage";
  }
}

export function isRegisteredLocally(followDate: string): boolean {
  try {
    return localStorage.getItem(`${REGISTERED_KEY}:${followDate}`) === "1";
  } catch {
    return false;
  }
}

export function markRegisteredLocally(followDate: string): void {
  try {
    localStorage.setItem(`${REGISTERED_KEY}:${followDate}`, "1");
  } catch {
    /* ignore */
  }
}
