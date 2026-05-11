-- 006_analytics.sql
-- 어드민 데이터 분석용 페이지뷰 이벤트 로그
-- visitor_hash = sha256(ip + ua + ANALYTICS_SECRET + YYYYMMDD)[:16]
-- 일일 회전 솔트 → 같은 사용자도 매일 다른 해시 (DAU 정확, 개인 식별 불가).
-- 봇은 미들웨어 단계에서 필터되어 INSERT 자체를 안 함 (테이블 비대 방지).

CREATE TABLE IF NOT EXISTS analytics_events (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ts            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  path          VARCHAR(255)  NOT NULL,
  referrer      VARCHAR(500)  NULL,
  ref_host      VARCHAR(100)  NULL,
  visitor_hash  CHAR(16)      NOT NULL,
  is_bot        TINYINT(1)    NOT NULL DEFAULT 0,
  country       CHAR(2)       NULL,
  INDEX idx_ts (ts),
  INDEX idx_path_ts (path, ts),
  INDEX idx_visitor_ts (visitor_hash, ts),
  INDEX idx_ref_ts (ref_host, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
