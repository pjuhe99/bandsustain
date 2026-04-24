-- quotes_seed.sql
-- bandsustain.com /quote 탭 초기 샘플 데이터
-- 수동 실행: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/seed/quotes_seed.sql
-- ※ 실행 전 사용자에게 내용 확인받고, 원하는 경우 문구를 수정한다.

INSERT INTO quotes (text, lang, text_translated, attribution, portrait_url, published) VALUES
  ('좋은 곡을 듣는다는 것은, 좋은 삶을 살고 있다는 뜻입니다.',
   'ko', NULL, '서스테인', NULL, 1),
  ('아무것도 하지 않을 때, 우리는 가장 많은 것을 하고 있다.',
   'ko', NULL, '서스테인, 밴드 리더', '/members/member01.jpg', 1),
  ('Don''t do today what you can put off until tomorrow.',
   'en', '내일로 미룰 수 있는 일은 오늘 하지 마라.', 'John, age unknown', NULL, 1),
  ('배고프면 먹어라. 졸리면 자라. 그게 전부다.',
   'ko', NULL, '이름 모를 할아버지', NULL, 1),
  ('Every great song is secretly a shopping list.',
   'en', NULL, 'anonymous', NULL, 1);
