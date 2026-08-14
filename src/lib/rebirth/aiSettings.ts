import "server-only";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { decryptApiKey, encryptApiKey } from "@/lib/yeongminCrypto";

type SettingsRow = RowDataPacket & {
  api_key_encrypted: string;
  model_name: string;
};

export async function getRebirthAiSettings() {
  const [rows] = await getPool().query<SettingsRow[]>(
    "SELECT api_key_encrypted, model_name FROM rebirth_ai_settings WHERE id = 1 LIMIT 1",
  );
  const settings = rows[0];
  if (!settings) return null;
  return {
    apiKey: decryptApiKey(settings.api_key_encrypted),
    model: settings.model_name,
  };
}

export async function setRebirthAiSettings(apiKey: string, model: string) {
  const encrypted = encryptApiKey(apiKey.trim());
  await getPool().query(
    `INSERT INTO rebirth_ai_settings (id, api_key_encrypted, model_name)
     VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE api_key_encrypted = VALUES(api_key_encrypted), model_name = VALUES(model_name)`,
    [encrypted, model],
  );
}
