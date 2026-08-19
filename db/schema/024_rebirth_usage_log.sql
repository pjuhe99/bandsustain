CREATE TABLE IF NOT EXISTS rebirth_usage_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  seed VARCHAR(64) NOT NULL,
  outcome VARCHAR(20) NOT NULL,
  attempt TINYINT UNSIGNED NOT NULL DEFAULT 0,
  model_name VARCHAR(100) NULL,
  input_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  output_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  total_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  estimated_cost_usd DECIMAL(12,8) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rebirth_usage_created (created_at),
  KEY idx_rebirth_usage_seed (seed),
  KEY idx_rebirth_usage_outcome_created (outcome, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
