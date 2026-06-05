-- 021 합주실 전화번호 (네이버 임포트 연락수단). 멱등.
SET @ddl := IF(
  NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playground_studios' AND COLUMN_NAME = 'phone'),
  'ALTER TABLE playground_studios ADD COLUMN phone VARCHAR(40) NULL AFTER road_address',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
