-- 001_quotes.sql
-- bandsustain.com /quote 탭 — 가짜 명언 저장 테이블
-- 수동 실행: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/schema/001_quotes.sql

CREATE TABLE IF NOT EXISTS quotes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  text            TEXT           NOT NULL,
  lang            ENUM('ko','en') NOT NULL,
  text_translated TEXT           NULL,
  attribution     VARCHAR(120)   NULL,
  portrait_url    VARCHAR(255)   NULL,
  published       TINYINT(1)     NOT NULL DEFAULT 1,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_published_created (published, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
