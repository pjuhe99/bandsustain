-- 020 합주실 방(room) 구조 + 합주실 추가 메타. 멱등.
-- studios.id 는 INT UNSIGNED → 방 FK 동일 타입.

-- 1) studios 컬럼 추가 (존재 시 무시되도록 동적 ADD)
SET @ddl := IF(
  NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'playground_studios' AND COLUMN_NAME = 'road_address'),
  'ALTER TABLE playground_studios
     ADD COLUMN road_address  VARCHAR(255) NULL AFTER area_label,
     ADD COLUMN booking_method VARCHAR(120) NULL AFTER booking_url,
     ADD COLUMN amenities      VARCHAR(120) NULL AFTER booking_method,
     ADD COLUMN homepage_url   VARCHAR(255) NULL AFTER map_url',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) rooms 테이블
CREATE TABLE IF NOT EXISTS playground_studio_rooms (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  studio_id      INT UNSIGNED NOT NULL,
  name           VARCHAR(120) NOT NULL,
  hourly_price   INT UNSIGNED NULL,
  capacity       INT UNSIGNED NULL,
  equipment_json JSON NULL,
  review         TEXT NULL,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_room_studio FOREIGN KEY (studio_id) REFERENCES playground_studios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  KEY idx_room_studio (studio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
