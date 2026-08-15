-- Preserve the first generated scene for a shareable rebirth result.
CREATE TABLE IF NOT EXISTS rebirth_share_scenes (
  seed VARCHAR(64) NOT NULL PRIMARY KEY,
  scene TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
