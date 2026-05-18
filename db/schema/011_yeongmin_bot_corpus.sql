-- 011_yeongmin_bot_corpus.sql
-- Add structured voice corpus storage for the Yeongmin bot admin
-- Manual run: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/schema/011_yeongmin_bot_corpus.sql

ALTER TABLE yeongmin_settings
  ADD COLUMN voice_corpus_json MEDIUMTEXT NULL
  AFTER section_examples;
