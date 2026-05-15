-- 010_yeongmin_bot.sql
-- bandsustain.com /playground/kim-yeongmin-bot — 김영민 캐릭터봇 settings + usage log
-- 수동 실행: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/schema/010_yeongmin_bot.sql

CREATE TABLE IF NOT EXISTS yeongmin_settings (
  id                       TINYINT      PRIMARY KEY DEFAULT 1,
  api_key_encrypted        TEXT         NULL,
  model_name               VARCHAR(60)  NOT NULL DEFAULT 'gpt-4o-mini',
  input_rate_per_1m_usd    DECIMAL(8,4) NOT NULL DEFAULT 0.1500,
  output_rate_per_1m_usd   DECIMAL(8,4) NOT NULL DEFAULT 0.6000,
  daily_token_cap          INT          NOT NULL DEFAULT 10000000,
  session_msg_cap          SMALLINT     NOT NULL DEFAULT 30,
  profile_image_path       VARCHAR(255) NULL,
  section_identity         TEXT         NULL,
  section_role             TEXT         NULL,
  section_tone             TEXT         NULL,
  section_personality      TEXT         NULL,
  section_knowledge        TEXT         NULL,
  section_likes            TEXT         NULL,
  section_dislikes         TEXT         NULL,
  section_forbidden        TEXT         NULL,
  section_unknown_handling TEXT         NULL,
  section_examples         MEDIUMTEXT   NULL,
  updated_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_yeongmin_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS yeongmin_usage_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  session_id      CHAR(36)      NOT NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  input_tokens    INT           NOT NULL,
  output_tokens   INT           NOT NULL,
  model_name      VARCHAR(60)   NOT NULL,
  cost_usd        DECIMAL(10,6) NOT NULL,
  KEY idx_created (created_at),
  KEY idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
