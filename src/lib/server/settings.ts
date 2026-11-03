// === App-Settings (server-only, pro Space) ===
//
// Dünne Key/Value-Schicht über der `settings`-Tabelle (V2-Migration,
// seit V10 mit space_id), genutzt von den KI-Funktionen (API-Key,
// Modell, Base-URL) und der Settings-API. Alle Funktionen sind async
// (mysql2-Pool aus db.ts). Jeder Space hat seine eigene KI-Konfiguration
// — Freunde bringen ihren eigenen Provider-Key mit, statt den des
// Familien-Spaces zu teilen.
//
// Bekannte Keys (als Konstanten, damit keine Magic Strings entstehen):
//   AI_API_KEY  — Provider-API-Key (geheim, nie an den Client)
//   AI_MODEL    — Modell-String, z. B. "glm-4.6"
//   AI_BASE_URL — OpenAI-kompatible Base-URL, z. B. "https://api.z.ai/api/paas/v4"

import { pool } from './db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

/** Bekannte Setting-Keys (keine Magic Strings im restlichen Code). */
export const SETTINGS = {
  AI_API_KEY: 'AI_API_KEY',
  AI_MODEL: 'AI_MODEL',
  AI_BASE_URL: 'AI_BASE_URL'
} as const;

/** Default-Werte, falls in der DB noch nichts gesetzt. */
export const DEFAULT_MODEL = 'glm-4.6';
export const DEFAULT_BASE_URL = 'https://api.z.ai/api/paas/v4';

/** Liefert den Wert eines Settings im Space oder null, falls nicht gesetzt. */
export async function getSetting(spaceId: number, key: string): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT `value` FROM settings WHERE space_id = ? AND `key` = ?',
    [spaceId, key]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as { value: string };
  return row.value;
}

/** Liefert den Wert eines Settings oder einen Fallback. */
export async function getSettingOrDefault(
  spaceId: number,
  key: string,
  fallback: string
): Promise<string> {
  const value = await getSetting(spaceId, key);
  return value ?? fallback;
}

/** Setzt (oder überschreibt) ein Setting im Space. Leerstring löscht den Eintrag. */
export async function setSetting(spaceId: number, key: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed === '') {
    await pool.execute('DELETE FROM settings WHERE space_id = ? AND `key` = ?', [spaceId, key]);
    return;
  }
  await pool.execute<ResultSetHeader>(
    `INSERT INTO settings (space_id, \`key\`, \`value\`) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
    [spaceId, key, trimmed]
  );
}

// --- KI-spezifische Komfort-Helper ---

/** Provider-API-Key (raw) des Spaces oder null, falls keiner konfiguriert ist. */
export async function getApiKey(spaceId: number): Promise<string | null> {
  return getSetting(spaceId, SETTINGS.AI_API_KEY);
}

/** Konfiguriertes Modell oder der Default (z. B. glm-4.6). */
export async function getModel(spaceId: number): Promise<string> {
  return getSettingOrDefault(spaceId, SETTINGS.AI_MODEL, DEFAULT_MODEL);
}

/** Konfigurierte OpenAI-kompatible Base-URL oder der Default (z.ai). */
export async function getBaseUrl(spaceId: number): Promise<string> {
  return getSettingOrDefault(spaceId, SETTINGS.AI_BASE_URL, DEFAULT_BASE_URL);
}

/** Maskiert einen API-Key für die Anzeige im Client: „••••" + letzte 4 Zeichen. */
export function maskKey(key: string): string {
  if (key.length <= 4) return '••••';
  return '••••' + key.slice(-4);
}
