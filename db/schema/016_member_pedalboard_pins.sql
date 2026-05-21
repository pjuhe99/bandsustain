-- 016_member_pedalboard_pins.sql
-- /playground/pedalboard-planner/gallery 멤버 페달보드 핀
-- 갤러리 상단에 별도 코너로 노출되는 큐레이션 메타 (admin 전용).
-- 수동 실행:
--   set -a; source /var/www/html/_______site_BANDSUSTAIN/.db_credentials; set +a
--   mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
--     < db/schema/016_member_pedalboard_pins.sql

CREATE TABLE IF NOT EXISTS playground_member_pins (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  layout_id       BIGINT UNSIGNED NOT NULL,
  member_id       INT             NOT NULL,
  override_title  VARCHAR(200)    NULL,
  caption         VARCHAR(280)    NULL,
  pin_order       INT             NOT NULL DEFAULT 0,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pin_layout_member (layout_id, member_id),
  KEY idx_pin_order (pin_order, id),
  KEY idx_pin_member (member_id),
  CONSTRAINT fk_pin_layout FOREIGN KEY (layout_id)
    REFERENCES playground_layouts(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pin_member FOREIGN KEY (member_id)
    REFERENCES members(id)            ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
