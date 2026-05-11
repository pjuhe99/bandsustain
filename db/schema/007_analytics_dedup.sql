-- 007_analytics_dedup.sql
-- (visitor_hash, path, 30초 bucket) unique index + INSERT IGNORE 패턴으로
-- prefetch · 새로고침 연타 등 동일 사용자의 같은 페이지 짧은 시간 내 중복
-- INSERT 차단. 30초 바깥 진짜 후속 방문은 그대로 카운트.
--
-- 기존 raw 데이터는 거의 전부 dev 트래픽 + prefetch 노이즈라 TRUNCATE 후
-- 깨끗한 baseline 으로 시작.

TRUNCATE TABLE analytics_events;

ALTER TABLE analytics_events
  ADD COLUMN bucket_30s INT GENERATED ALWAYS AS (FLOOR(UNIX_TIMESTAMP(ts) / 30)) STORED,
  ADD UNIQUE INDEX uk_visitor_path_bucket (visitor_hash, path, bucket_30s);
