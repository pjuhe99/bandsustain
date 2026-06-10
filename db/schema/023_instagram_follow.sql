-- 인스타 맞팔 분석기: 서스테인 팔로우 명예의 전당
CREATE TABLE IF NOT EXISTS instagram_follow_hof (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nickname VARCHAR(20) NOT NULL,
  sustain_followed_at DATE NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  browser_token_hash CHAR(64) NULL,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_iphash_followdate (ip_hash, sustain_followed_at),
  KEY idx_rank (is_visible, sustain_followed_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
