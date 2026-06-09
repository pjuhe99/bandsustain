-- 022 합주실 대표 이미지(네이버 원본 CDN URL). 핫링크 표시용, 서버 미호스팅. 멱등.
SET @ddl := IF(
  NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playground_studios' AND COLUMN_NAME = 'image_url'),
  'ALTER TABLE playground_studios ADD COLUMN image_url VARCHAR(500) NULL AFTER map_url',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
