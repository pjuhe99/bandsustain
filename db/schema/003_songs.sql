-- 003_songs.sql
-- bandsustain.com /songs 탭 — 곡 카드 + 가사 데이터

CREATE TABLE IF NOT EXISTS songs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(255)   NOT NULL,
  category     ENUM('Album','EP','Single','Live Session') NOT NULL,
  artwork_url  VARCHAR(255)   NOT NULL,
  listen_url   VARCHAR(500)   NULL,
  lyrics       TEXT           NULL,
  released_at  DATE           NOT NULL,
  published    TINYINT(1)     NOT NULL DEFAULT 1,
  created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_published_released (published, released_at DESC, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
