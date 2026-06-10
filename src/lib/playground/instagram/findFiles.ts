export type ConnectionFiles = { followers: string[]; following: string | null };

const FOLLOWERS_RE = /^followers(_\d+)?\.html$/i;
const FOLLOWING_RE = /^following\.html$/i;
const STANDARD_DIR = "followers_and_following/";

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

function followerNum(p: string): number {
  const m = basename(p).toLowerCase().match(/_(\d+)\.html$/);
  return m ? +m[1] : 0;
}

function pick(paths: string[]): ConnectionFiles {
  const followers = paths
    .filter((p) => FOLLOWERS_RE.test(basename(p)))
    .sort((a, b) => followerNum(a) - followerNum(b));
  const following = paths.find((p) => FOLLOWING_RE.test(basename(p))) ?? null;
  return { followers, following };
}

export function matchConnectionFiles(allPaths: string[]): ConnectionFiles {
  // 1순위: 표준 디렉터리 안에서 탐색, 폴백: 전체 경로에서 basename 매칭
  const standard = pick(allPaths.filter((p) => p.toLowerCase().includes(STANDARD_DIR)));
  if (standard.followers.length > 0 || standard.following) return standard;
  return pick(allPaths);
}
