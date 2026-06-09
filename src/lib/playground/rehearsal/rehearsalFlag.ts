// dev 전용 노출 게이트. ecosystem.config.js(DEV-only, --skip-worktree)에만
// REHEARSAL_FINDER_ENABLED="1" 이 설정됨 → PROD ecosystem 엔 없으므로 PROD 자동 숨김.
export function isRehearsalFinderEnabled(): boolean {
  return process.env.REHEARSAL_FINDER_ENABLED === "1";
}
