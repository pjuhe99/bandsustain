-- 009_analytics_clicks.sql
-- 외부 링크 클릭 이벤트 별도 테이블.
-- 클라이언트 ClickTracker 가 document-level 리스너로 외부 <a> 클릭을
-- 캡처하여 /api/analytics/click 으로 POST. 곡/라이브 등 도메인 항목과
-- 연결할 때는 가장 가까운 [data-track-item-type] 조상의 data-attr 를 함께
-- 보냄 (item_type='song'|'live'|..., item_id=DB pk).
--
-- 5초 (visitor, target_url) bucket unique index 로 빠른 더블클릭 흡수.

CREATE TABLE IF NOT EXISTS analytics_clicks (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ts            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  path          VARCHAR(255)  NOT NULL,
  target_url    VARCHAR(500)  NOT NULL,
  target_host   VARCHAR(100)  NOT NULL,
  item_type     VARCHAR(40)   NULL,
  item_id       INT           NULL,
  visitor_hash  CHAR(16)      NOT NULL,
  bucket_5s     INT GENERATED ALWAYS AS (FLOOR(UNIX_TIMESTAMP(ts) / 5)) STORED,
  INDEX idx_ts (ts),
  INDEX idx_target_host_ts (target_host, ts),
  INDEX idx_item (item_type, item_id, ts),
  INDEX idx_visitor_ts (visitor_hash, ts),
  UNIQUE INDEX uk_visitor_target_bucket (visitor_hash, target_url, bucket_5s)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
