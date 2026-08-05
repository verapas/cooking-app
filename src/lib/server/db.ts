// === MariaDB-Zugriff (nur server-seitig) ===
//
// Verbindungsaufbau via mysql2-Promise-Pool (asynchron, mit Connection-
// Reuse). Das Schema selbst wird NICHT hier angelegt — übernimmt der
// Flyway-Container beim Deploy (siehe db/migration/V1__init_schema.sql).
//
// Row-Mapper: mysql2 liefert für DATETIME ein Date-Objekt und für
// TINYINT(1) echtes Boolean. Die Hilfsfunktion `toISOString` wandelt
// Date→string, damit die TypeScript-Typen (created_at: string etc.)
// erhalten bleiben und Client-Komponenten nichts merken.

import mysql, { type Pool, type PoolOptions, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import { env } from '$env/dynamic/private';

// --- Pool-Konfiguration aus Env-Variablen (Defaults für lokales Dev) ---
const poolOptions: PoolOptions = {
  host: env.DB_HOST ?? 'localhost',
  port: Number(env.DB_PORT ?? '3306'),
  user: env.DB_USER ?? 'cooking',
  password: env.DB_PASSWORD ?? 'cooking',
  database: env.DB_NAME ?? 'cooking',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Namen unquoted → als Bezeichner behandeln; "order" etc. wird in SQL
  // explizit gebacktickt, wo nötig.
  namedPlaceholders: false
};

// Singleton-Pool — einmal pro Prozess (wird von allen Query-Funktionen
// geteilt). In Serverless-Umgebungen ggf. anpassen, hier: ein Node-Prozess.
export const pool: Pool = mysql.createPool(poolOptions);

// =====================================================================
// Hilfsfunktionen: Typ-Umwandlung mysql2 → TypeScript
// =====================================================================

/** Wandelt ein Date-Objekt (oder undefined/null) in einen ISO-String um. */
export function toISOString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

type AnyRow = Record<string, unknown>;

/**
 * Normalisiert eine Zeile: DATETIME-Felder → ISO-String.
 * is_favorite wird von mysql2 bereits als Boolean geliefert (kein Mapping
 * nötig). Datums-Spalten zentral hier benennen, damit Client-Typen stabil
 * bleiben.
 */
function normalizeDates(row: AnyRow, dateColumns: string[]): AnyRow {
  const out: AnyRow = { ...row };
  for (const col of dateColumns) {
    if (col in out) out[col] = toISOString(out[col]);
  }
  return out;
}

const RECIPE_DATES = ['created_at', 'updated_at'];

// Re-Exports für queries.ts und API-Routen
export type { Pool, RowDataPacket, ResultSetHeader };
export { RECIPE_DATES, normalizeDates };
export type { AnyRow };
