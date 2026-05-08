-- 005_live_events.sql
-- bandsustain.com /live 탭 — 공연 일정 (예정 + 과거)

CREATE TABLE IF NOT EXISTS live_events (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  event_date  DATE          NOT NULL,
  venue       VARCHAR(200)  NOT NULL,
  city        VARCHAR(100)  NOT NULL,
  ticket_url  VARCHAR(500)  NULL,
  video_url   VARCHAR(500)  NULL,
  published   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_published_date (published, event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
