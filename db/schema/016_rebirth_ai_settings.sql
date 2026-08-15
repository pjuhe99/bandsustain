-- Dedicated encrypted configuration for the public "Your New Day" narration.
CREATE TABLE IF NOT EXISTS rebirth_ai_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  api_key_encrypted TEXT NOT NULL,
  model_name VARCHAR(100) NOT NULL DEFAULT 'gpt-5.6-sol',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_rebirth_ai_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
