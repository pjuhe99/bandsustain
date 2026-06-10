// 배포 계약: ecosystem.config.js(DEV-only, --skip-worktree)에만
// INSTAGRAM_FOLLOW_ENABLED="1" 이 설정됨 → PROD ecosystem 엔 없으므로 PROD 자동 숨김.
// 런칭 시 PROD ecosystem 에 INSTAGRAM_FOLLOW_ENABLED="1" 추가 후 pm2 restart.
export function isInstagramFollowEnabled(): boolean {
  return process.env.INSTAGRAM_FOLLOW_ENABLED === "1";
}
