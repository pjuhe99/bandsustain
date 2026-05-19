-- 013_playground_planner.sql
-- bandsustain.com /playground/pedalboard-planner — pedalboard planner
-- 공식 카탈로그 (pedalplayground 데이터셋) + 사용자 데이터 (owner_token 기반).
-- 수동 실행: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/schema/013_playground_planner.sql
--
-- 안정 식별자 규약:
--   - 공식 카탈로그 row 는 (brand_id, name) 으로만 식별한다.
--   - width_in / height_in / image_filename 같은 mutable 필드는 식별자에서 제외.
--   - 카탈로그 교정으로 같은 (brand, name) 의 치수/이미지가 바뀌어도 동일 row 가 UPDATE 된다.

-- ── 공식 카탈로그: 브랜드 ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playground_pedal_brands (
  id           INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(120)  NOT NULL,
  slug         VARCHAR(140)  NOT NULL,
  search_name  VARCHAR(140)  NOT NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pedal_brand_name (name),
  UNIQUE KEY uk_pedal_brand_slug (slug),
  KEY idx_pedal_brand_search (search_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS playground_board_brands (
  id           INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(120)  NOT NULL,
  slug         VARCHAR(140)  NOT NULL,
  search_name  VARCHAR(140)  NOT NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_board_brand_name (name),
  UNIQUE KEY uk_board_brand_slug (slug),
  KEY idx_board_brand_search (search_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 공식 카탈로그: 아이템 ────────────────────────────────────────────────
-- (brand_id, name) 가 유일 식별자. 다른 필드는 모두 갱신 대상.

CREATE TABLE IF NOT EXISTS playground_pedals (
  id              INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  brand_id        INT UNSIGNED   NOT NULL,
  name            VARCHAR(200)   NOT NULL,
  slug            VARCHAR(220)   NOT NULL,
  search_name     VARCHAR(220)   NOT NULL,
  width_in        DECIMAL(6,3)   NOT NULL,
  height_in       DECIMAL(6,3)   NOT NULL,
  image_filename  VARCHAR(255)   NULL,
  is_active       TINYINT(1)     NOT NULL DEFAULT 1,
  source_revision INT UNSIGNED   NOT NULL DEFAULT 1,
  last_imported_at TIMESTAMP     NULL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pedal_brand_name (brand_id, name),
  UNIQUE KEY uk_pedal_brand_slug (brand_id, slug),
  KEY idx_pedal_search (search_name),
  KEY idx_pedal_active (is_active),
  CONSTRAINT fk_pedal_brand FOREIGN KEY (brand_id) REFERENCES playground_pedal_brands(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS playground_boards (
  id              INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  brand_id        INT UNSIGNED   NOT NULL,
  name            VARCHAR(200)   NOT NULL,
  slug            VARCHAR(220)   NOT NULL,
  search_name     VARCHAR(220)   NOT NULL,
  width_in        DECIMAL(6,3)   NOT NULL,
  height_in       DECIMAL(6,3)   NOT NULL,
  image_filename  VARCHAR(255)   NULL,
  is_active       TINYINT(1)     NOT NULL DEFAULT 1,
  source_revision INT UNSIGNED   NOT NULL DEFAULT 1,
  last_imported_at TIMESTAMP     NULL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_board_brand_name (brand_id, name),
  UNIQUE KEY uk_board_brand_slug (brand_id, slug),
  KEY idx_board_search (search_name),
  KEY idx_board_active (is_active),
  CONSTRAINT fk_board_brand FOREIGN KEY (brand_id) REFERENCES playground_board_brands(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 사용자 커스텀 아이템 (공식 카탈로그와 분리) ─────────────────────────

CREATE TABLE IF NOT EXISTS playground_custom_items (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_token  CHAR(32)        NOT NULL,
  kind         ENUM('pedal','board') NOT NULL,
  label        VARCHAR(200)    NOT NULL,
  width_in     DECIMAL(6,3)    NOT NULL,
  height_in    DECIMAL(6,3)    NOT NULL,
  color_hex    CHAR(7)         NULL,
  image_path   VARCHAR(255)    NULL,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_custom_owner_kind (owner_token, kind),
  KEY idx_custom_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 사용자 레이아웃 (normalized rows + snapshot JSON 병행) ──────────────

CREATE TABLE IF NOT EXISTS playground_layouts (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_token      CHAR(32)        NOT NULL,
  title            VARCHAR(200)    NOT NULL,
  board_kind       ENUM('catalog','custom') NOT NULL,
  catalog_board_id INT UNSIGNED    NULL,
  custom_board_id  BIGINT UNSIGNED NULL,
  visibility       ENUM('private','unlisted','public') NOT NULL DEFAULT 'private',
  share_token      CHAR(32)        NOT NULL,
  snapshot_json    LONGTEXT        NULL,
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_layout_share_token (share_token),
  KEY idx_layout_owner (owner_token),
  KEY idx_layout_visibility (visibility),
  CONSTRAINT fk_layout_catalog_board FOREIGN KEY (catalog_board_id) REFERENCES playground_boards(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_layout_custom_board  FOREIGN KEY (custom_board_id)  REFERENCES playground_custom_items(id) ON DELETE SET NULL ON UPDATE CASCADE
  -- 무결성 (board_kind='catalog' XOR custom_board_id IS NULL) 은 어플리케이션 layer 에서 강제.
  -- MariaDB 10.5 가 self-column-reference CHECK 를 거부함.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 레이아웃 아이템 (정규화: 페달 한 개 = 한 row) ──────────────────────

CREATE TABLE IF NOT EXISTS playground_layout_items (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  layout_id        BIGINT UNSIGNED NOT NULL,
  item_kind        ENUM('catalog','custom') NOT NULL,
  catalog_pedal_id INT UNSIGNED    NULL,
  custom_item_id   BIGINT UNSIGNED NULL,
  position_x_in    DECIMAL(7,3)    NOT NULL,
  position_y_in    DECIMAL(7,3)    NOT NULL,
  rotation_deg     DECIMAL(6,2)    NOT NULL DEFAULT 0,
  z_order          INT             NOT NULL DEFAULT 0,
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_layout_items_layout (layout_id, z_order),
  CONSTRAINT fk_layout_item_layout  FOREIGN KEY (layout_id)        REFERENCES playground_layouts(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_layout_item_catalog FOREIGN KEY (catalog_pedal_id) REFERENCES playground_pedals(id)  ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_layout_item_custom  FOREIGN KEY (custom_item_id)   REFERENCES playground_custom_items(id) ON DELETE SET NULL ON UPDATE CASCADE
  -- 무결성 (item_kind='catalog' XOR custom_item_id IS NULL) 은 어플리케이션 layer 에서 강제. (위 layouts 와 동일 이유)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
