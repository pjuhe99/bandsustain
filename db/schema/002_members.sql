-- 002_members.sql
-- bandsustain.com /members 탭 — 멤버 카드 데이터
-- 수동 실행: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/schema/002_members.sql

CREATE TABLE IF NOT EXISTS members (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name_en         VARCHAR(80)    NOT NULL,
  name_kr         VARCHAR(40)    NOT NULL,
  position        VARCHAR(120)   NOT NULL,
  photo_url       VARCHAR(255)   NOT NULL,
  favorite_artist VARCHAR(120)   NULL,
  favorite_song   VARCHAR(255)   NULL,
  display_order   INT            NOT NULL DEFAULT 0,
  published       TINYINT(1)     NOT NULL DEFAULT 1,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_published_order (published, display_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
