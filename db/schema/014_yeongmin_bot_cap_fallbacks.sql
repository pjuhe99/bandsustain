-- 014_yeongmin_bot_cap_fallbacks.sql
-- Make the session-cap and daily-cap fallback messages editable from admin.
-- NULL means "use the hardcoded default in chat/route.ts".
-- Manual run: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/schema/014_yeongmin_bot_cap_fallbacks.sql

ALTER TABLE yeongmin_settings
  ADD COLUMN session_cap_fallback_reply TEXT NULL AFTER long_input_fallback_reply,
  ADD COLUMN daily_cap_fallback_reply   TEXT NULL AFTER session_cap_fallback_reply;
