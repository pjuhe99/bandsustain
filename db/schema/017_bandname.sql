-- 017_bandname.sql
-- 밴드 이름 생성기 데이터 관리자(/admin/band-name) 4테이블.
-- 수동 실행 (DEV 먼저):
--   set -a; source /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials; set +a
--   mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < db/schema/017_bandname.sql

CREATE TABLE IF NOT EXISTS bandname_words (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  language   ENUM('korean','english') NOT NULL,
  category   VARCHAR(32) NOT NULL,
  word       VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_word (language, category, word)
);

CREATE TABLE IF NOT EXISTS bandname_patterns (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pattern_key   VARCHAR(64) NOT NULL,
  language      ENUM('korean','english') NOT NULL,
  slots         JSON NOT NULL,
  scenes        JSON NOT NULL,
  moods         JSON NOT NULL,
  `separator`   VARCHAR(4) NOT NULL DEFAULT '',
  min_weirdness TINYINT NOT NULL,
  max_weirdness TINYINT NOT NULL,
  weight        INT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pattern_key (pattern_key)
);

CREATE TABLE IF NOT EXISTS bandname_pairs (
  id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind   ENUM('preferred','blocked') NOT NULL,
  word_a VARCHAR(64) NOT NULL,
  word_b VARCHAR(64) NOT NULL,
  UNIQUE KEY uk_pair (kind, word_a, word_b)
);

CREATE TABLE IF NOT EXISTS bandname_blocked_names (
  id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  UNIQUE KEY uk_name (name)
);
