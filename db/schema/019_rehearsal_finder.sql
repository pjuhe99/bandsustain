-- 019_rehearsal_finder.sql
-- bandsustain.com /playground/rehearsal-finder — 합주실 추천
-- 멤버 출발지 기반 이동시간/가격/인원/장비 점수화. dev 전용 노출.
-- 수동 실행: set -a; source <DEV site>/.db_credentials; set +a
--   mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME < db/schema/019_rehearsal_finder.sql
-- equipment_type 은 DB ENUM 대신 VARCHAR(32) + 앱레벨(TS union+Zod enum) 검증.

-- ── 지역 마스터 ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playground_regions (
  id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  province      VARCHAR(40)   NOT NULL,
  city          VARCHAR(40)   NULL,
  district      VARCHAR(40)   NULL,
  display_name  VARCHAR(80)   NOT NULL,
  is_supported  TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order    INT           NOT NULL DEFAULT 0,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_region_name (display_name),
  KEY idx_region_supported_sort (is_supported, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS playground_studios (
  id                    INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(160)  NOT NULL,
  slug                  VARCHAR(180)  NOT NULL,
  region_id             INT UNSIGNED  NULL,
  area_label            VARCHAR(120)  NULL,
  lat                   DECIMAL(10,7) NULL,
  lng                   DECIMAL(10,7) NULL,
  nearest_station       VARCHAR(80)   NULL,
  nearest_station_meters INT UNSIGNED NULL,
  hourly_price_min      INT UNSIGNED  NULL,
  hourly_price_max      INT UNSIGNED  NULL,
  min_capacity          INT UNSIGNED  NULL,
  max_capacity          INT UNSIGNED  NULL,
  has_parking           TINYINT(1)    NOT NULL DEFAULT 0,
  parking_note          VARCHAR(200)  NULL,
  status                ENUM('candidate','approved','hidden','closed') NOT NULL DEFAULT 'candidate',
  source_note           VARCHAR(255)  NULL,
  booking_url           VARCHAR(255)  NULL,
  map_url               VARCHAR(255)  NULL,
  verified_at           TIMESTAMP     NULL,
  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_studio_slug (slug),
  KEY idx_studio_status (status),
  KEY idx_studio_region (region_id),
  CONSTRAINT fk_studio_region FOREIGN KEY (region_id) REFERENCES playground_regions(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS playground_studio_equipment (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  studio_id      INT UNSIGNED    NOT NULL,
  equipment_type VARCHAR(32)     NOT NULL,
  equipment_name VARCHAR(120)    NULL,
  quantity       INT UNSIGNED    NOT NULL DEFAULT 1,
  note           VARCHAR(200)    NULL,
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_equip_studio (studio_id),
  KEY idx_equip_type (equipment_type),
  CONSTRAINT fk_equip_studio FOREIGN KEY (studio_id) REFERENCES playground_studios(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS playground_rehearsal_searches (
  id                       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_count             INT UNSIGNED    NOT NULL,
  transport_mode           ENUM('transit','car','mixed') NOT NULL DEFAULT 'transit',
  max_budget_per_hour      INT UNSIGNED    NULL,
  required_equipment_json  JSON            NULL,
  preferred_region_ids_json JSON           NULL,
  search_status            ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  error_note               VARCHAR(255)    NULL,
  created_at               TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_search_status_created (search_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS playground_rehearsal_search_members (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  search_id      BIGINT UNSIGNED NOT NULL,
  nickname       VARCHAR(40)     NOT NULL,
  origin_text    VARCHAR(160)    NOT NULL,
  origin_lat     DECIMAL(10,7)   NULL,
  origin_lng     DECIMAL(10,7)   NULL,
  origin_type    ENUM('station','address','district','manual') NOT NULL DEFAULT 'manual',
  transport_mode ENUM('transit','car','mixed') NOT NULL DEFAULT 'transit',
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_search_member (search_id),
  CONSTRAINT fk_search_member FOREIGN KEY (search_id) REFERENCES playground_rehearsal_searches(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS playground_route_cache (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  origin_key        VARCHAR(40)     NOT NULL,
  origin_lat        DECIMAL(10,7)   NOT NULL,
  origin_lng        DECIMAL(10,7)   NOT NULL,
  destination_id    INT UNSIGNED    NOT NULL,
  transport_mode    ENUM('transit','car','mixed') NOT NULL,
  time_bucket       ENUM('weekday_day','weekday_evening','weekday_night','weekend_day','weekend_night','unknown') NOT NULL DEFAULT 'unknown',
  travel_minutes    INT UNSIGNED    NOT NULL,
  transfer_count    INT UNSIGNED    NOT NULL DEFAULT 0,
  walking_minutes   INT UNSIGNED    NOT NULL DEFAULT 0,
  fare              INT UNSIGNED    NULL,
  distance_meters   INT UNSIGNED    NOT NULL DEFAULT 0,
  provider          ENUM('mock','kakao','odsay','tmap','manual') NOT NULL DEFAULT 'mock',
  raw_response_json JSON            NULL,
  expires_at        TIMESTAMP       NOT NULL,
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_route_cache (origin_key, destination_id, transport_mode, time_bucket),
  KEY idx_route_cache_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS playground_studio_recommendation_results (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  search_id             BIGINT UNSIGNED NOT NULL,
  studio_id             INT UNSIGNED    NOT NULL,
  rank_no               INT UNSIGNED    NOT NULL,
  score                 DECIMAL(10,3)   NOT NULL,
  avg_minutes           DECIMAL(8,2)    NOT NULL,
  max_minutes           DECIMAL(8,2)    NOT NULL,
  min_minutes           DECIMAL(8,2)    NOT NULL,
  spread_minutes        DECIMAL(8,2)    NOT NULL,
  avg_transfer          DECIMAL(6,2)    NOT NULL,
  avg_walking           DECIMAL(6,2)    NOT NULL,
  price_penalty         DECIMAL(8,2)    NOT NULL DEFAULT 0,
  capacity_penalty      DECIMAL(8,2)    NOT NULL DEFAULT 0,
  equipment_penalty     DECIMAL(8,2)    NOT NULL DEFAULT 0,
  fairness_score        DECIMAL(8,2)    NOT NULL DEFAULT 0,
  recommendation_reason VARCHAR(400)    NULL,
  raw_score_json        JSON            NULL,
  created_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_result_search_rank (search_id, rank_no),
  CONSTRAINT fk_result_search FOREIGN KEY (search_id) REFERENCES playground_rehearsal_searches(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_result_studio FOREIGN KEY (studio_id) REFERENCES playground_studios(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
