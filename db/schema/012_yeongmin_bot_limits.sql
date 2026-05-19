-- 012_yeongmin_bot_limits.sql
-- Add input/output length control settings for the Yeongmin bot admin
-- Manual run: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/schema/012_yeongmin_bot_limits.sql

ALTER TABLE yeongmin_settings
  ADD COLUMN input_char_limit INT NOT NULL DEFAULT 400 AFTER session_msg_cap,
  ADD COLUMN long_input_fallback_reply TEXT NULL AFTER input_char_limit,
  ADD COLUMN output_max_chars INT NOT NULL DEFAULT 220 AFTER long_input_fallback_reply,
  ADD COLUMN output_max_lines SMALLINT NOT NULL DEFAULT 6 AFTER output_max_chars,
  ADD COLUMN output_max_tokens SMALLINT NOT NULL DEFAULT 220 AFTER output_max_lines;
