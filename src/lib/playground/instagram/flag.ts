export function isInstagramFollowEnabled(): boolean {
  return process.env.INSTAGRAM_FOLLOW_ENABLED === "1";
}
