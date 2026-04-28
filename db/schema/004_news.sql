-- 004_news.sql
-- bandsustain.com /news 탭 — 뉴스 카드 + 본문 데이터

CREATE TABLE IF NOT EXISTS news (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  headline    VARCHAR(255)   NOT NULL,
  category    VARCHAR(40)    NOT NULL,
  date        DATE           NOT NULL,
  hero_image  VARCHAR(255)   NOT NULL,
  body        MEDIUMTEXT     NOT NULL,
  mid_image   VARCHAR(255)   NULL,
  published   TINYINT(1)     NOT NULL DEFAULT 1,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_published_date (published, date DESC, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
