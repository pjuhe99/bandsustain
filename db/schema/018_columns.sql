-- 018_columns.sql
-- bandsustain.com /columns 탭 — 멤버별 칼럼 게시판 (주제/글/댓글)

CREATE TABLE IF NOT EXISTS column_topics (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(120)  NOT NULL,
  member_id   INT           NULL,
  description VARCHAR(500)  NULL,
  visible     TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order  INT           NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_topic_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL,
  INDEX idx_visible_sort (visible, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS column_posts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  topic_id     INT           NOT NULL,
  title        VARCHAR(200)  NOT NULL,
  hero_image   VARCHAR(255)  NULL,
  excerpt      VARCHAR(500)  NULL,
  body         MEDIUMTEXT    NOT NULL,
  view_count   INT           NOT NULL DEFAULT 0,
  published    TINYINT(1)    NOT NULL DEFAULT 0,
  published_at TIMESTAMP     NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_post_topic FOREIGN KEY (topic_id) REFERENCES column_topics(id) ON DELETE CASCADE,
  INDEX idx_published_order (published, published_at DESC, id),
  INDEX idx_topic (topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS column_comments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  post_id       INT           NOT NULL,
  nickname      VARCHAR(40)   NOT NULL,
  password_hash VARCHAR(72)   NULL,
  body          VARCHAR(1000) NOT NULL,
  ip            VARCHAR(45)   NOT NULL,
  visible       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES column_posts(id) ON DELETE CASCADE,
  INDEX idx_post_visible (post_id, visible, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
