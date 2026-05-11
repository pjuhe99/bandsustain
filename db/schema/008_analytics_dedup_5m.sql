-- 008_analytics_dedup_5m.sql
-- 30초 → 5분 bucket으로 dedup 윈도우 확대.
-- 이유: Apache mod_security2 (OWASP CRS) 가 비표준 `Next-Router-Prefetch`
-- 헤더를 strip해서 미들웨어 단계의 prefetch 식별이 일부 새고 있다.
-- mod_security 손대지 않고 DB 레벨 윈도우만 늘려서 prefetch 중복을 흡수.
--
-- 5분 윈도우는 같은 세션 내 재방문(Top → Songs → Top)도 1번으로 카운트하지만
-- 소규모 사이트 분석 정확도 측면에서 prefetch 노이즈 제거가 더 큰 이득.

TRUNCATE TABLE analytics_events;

ALTER TABLE analytics_events
  DROP INDEX uk_visitor_path_bucket,
  DROP COLUMN bucket_30s,
  ADD COLUMN bucket_5m INT GENERATED ALWAYS AS (FLOOR(UNIX_TIMESTAMP(ts) / 300)) STORED,
  ADD UNIQUE INDEX uk_visitor_path_bucket (visitor_hash, path, bucket_5m);
