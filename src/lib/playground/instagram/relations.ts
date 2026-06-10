import type { AccountRelation, InstagramConnection, RelationResult } from "./types";

export function calculateRelations(
  followers: InstagramConnection[],
  following: InstagramConnection[],
): RelationResult {
  const map = new Map<string, AccountRelation>();

  const ensure = (c: InstagramConnection): AccountRelation => {
    let r = map.get(c.username);
    if (!r) {
      r = {
        username: c.username,
        profileUrl: c.profileUrl,
        isFollower: false,
        isFollowing: false,
        followerSince: null,
        followerSinceRaw: null,
        followingSince: null,
        followingSinceRaw: null,
      };
      map.set(c.username, r);
    }
    return r;
  };

  for (const c of followers) {
    const r = ensure(c);
    if (!r.isFollower) {
      r.isFollower = true;
      r.followerSince = c.followedAt;
      r.followerSinceRaw = c.followedAtRaw;
    }
  }
  for (const c of following) {
    const r = ensure(c);
    if (!r.isFollowing) {
      r.isFollowing = true;
      r.followingSince = c.followedAt;
      r.followingSinceRaw = c.followedAtRaw;
    }
  }

  const all = [...map.values()];
  return {
    followers: all.filter((r) => r.isFollower),
    following: all.filter((r) => r.isFollowing),
    mutuals: all.filter((r) => r.isFollower && r.isFollowing),
    notFollowingMeBack: all.filter((r) => r.isFollowing && !r.isFollower),
    iDoNotFollowBack: all.filter((r) => r.isFollower && !r.isFollowing),
  };
}
