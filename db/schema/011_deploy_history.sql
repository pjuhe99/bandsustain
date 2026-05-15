-- 011_deploy_history.sql
-- bandsustain.com /admin/deploy — git pull + build + pm2 restart 이력
-- 수동 실행: mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < db/schema/011_deploy_history.sql

CREATE TABLE IF NOT EXISTS deploy_history (
  id            BIGINT       AUTO_INCREMENT PRIMARY KEY,
  job_id        VARCHAR(40)  NOT NULL UNIQUE,
  actor         VARCHAR(64)  NOT NULL,
  kind          ENUM('deploy','rollback') NOT NULL,
  pre_head      CHAR(40)     NULL,
  post_head     CHAR(40)     NULL,
  target_ref    VARCHAR(100) NULL,
  status        ENUM('running','success','fail','interrupted') NOT NULL,
  fail_step     VARCHAR(40)  NULL,
  started_at    DATETIME     NOT NULL,
  ended_at      DATETIME     NULL,
  duration_sec  INT          NULL,
  log_path      VARCHAR(255) NOT NULL,
  INDEX idx_started_at (started_at DESC),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
