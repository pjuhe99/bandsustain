-- 012_yeongmin_rename.sql
-- 김영민 봇 테이블/저장 경로를 youngmin → yeongmin (정확한 영문 표기) 으로 일괄 rename.
-- RENAME TABLE 은 atomic. profile_image_path 의 경로 prefix 도 같이 갱신.
-- 수동 실행: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/schema/012_yeongmin_rename.sql

RENAME TABLE youngmin_settings  TO yeongmin_settings;
RENAME TABLE youngmin_usage_log TO yeongmin_usage_log;

UPDATE yeongmin_settings
   SET profile_image_path = REPLACE(profile_image_path, '/uploads/youngmin/', '/uploads/yeongmin/')
 WHERE profile_image_path LIKE '/uploads/youngmin/%';
