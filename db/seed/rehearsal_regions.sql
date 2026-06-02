-- rehearsal_regions.sql — 합주실 추천 지역 마스터 (서울 + 경기 주요시)
-- 수동 실행: set -a; source <DEV site>/.db_credentials; set +a
--   mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME < db/seed/rehearsal_regions.sql
INSERT INTO playground_regions (province, city, district, display_name, sort_order) VALUES
  ('서울특별시', NULL, '마포구', '서울 마포구', 10),
  ('서울특별시', NULL, '서대문구', '서울 서대문구', 11),
  ('서울특별시', NULL, '용산구', '서울 용산구', 12),
  ('서울특별시', NULL, '강남구', '서울 강남구', 13),
  ('서울특별시', NULL, '서초구', '서울 서초구', 14),
  ('서울특별시', NULL, '송파구', '서울 송파구', 15),
  ('서울특별시', NULL, '광진구', '서울 광진구', 16),
  ('서울특별시', NULL, '성동구', '서울 성동구', 17),
  ('서울특별시', NULL, '동대문구', '서울 동대문구', 18),
  ('서울특별시', NULL, '종로구', '서울 종로구', 19),
  ('서울특별시', NULL, '중구', '서울 중구', 20),
  ('서울특별시', NULL, '영등포구', '서울 영등포구', 21),
  ('서울특별시', NULL, '관악구', '서울 관악구', 22),
  ('서울특별시', NULL, '동작구', '서울 동작구', 23),
  ('경기도', '고양시', NULL, '경기 고양시', 50),
  ('경기도', '성남시', NULL, '경기 성남시', 51),
  ('경기도', '부천시', NULL, '경기 부천시', 52),
  ('경기도', '안양시', NULL, '경기 안양시', 53),
  ('경기도', '수원시', NULL, '경기 수원시', 54)
ON DUPLICATE KEY UPDATE province=VALUES(province), city=VALUES(city), district=VALUES(district), sort_order=VALUES(sort_order);
