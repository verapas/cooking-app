// === SQLite-Zugriff (nur server-seitig) ===
// better-sqlite3 ist synchron & schnell — ideal für SvelteKit-Load-Funktionen.

import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from '$env/dynamic/private';

export const DATABASE_PATH = resolve(env.DATABASE_PATH ?? './data/cooking.db');

// Verzeichnis der DB-Datei sicherstellen.
mkdirSync(dirname(DATABASE_PATH), { recursive: true });

export const db: DB = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schema (idempotent) ---
// Reihenfolge wichtig wegen Fremdschlüsseln:
// categories → recipes → steps → ingredients
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    icon       TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    description   TEXT,
    category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    base_servings INTEGER NOT NULL DEFAULT 2,
    prep_time_min INTEGER,
    cook_time_min INTEGER,
    image_url     TEXT,
    source        TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS steps (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id    INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    "order"      INTEGER NOT NULL,
    instruction  TEXT NOT NULL,
    duration_sec INTEGER
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    step_id    INTEGER REFERENCES steps(id) ON DELETE SET NULL,
    name       TEXT NOT NULL,
    quantity   REAL,
    unit       TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_recipes_category    ON recipes(category_id);
  CREATE INDEX IF NOT EXISTS idx_steps_recipe        ON steps(recipe_id);
  CREATE INDEX IF NOT EXISTS idx_ingredients_recipe  ON ingredients(recipe_id);
  CREATE INDEX IF NOT EXISTS idx_ingredients_step    ON ingredients(step_id);

  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);

  -- updated_at automatisch pflegen
  CREATE TRIGGER IF NOT EXISTS recipes_updated_at
    AFTER UPDATE ON recipes
    FOR EACH ROW
  BEGIN
    UPDATE recipes SET updated_at = datetime('now') WHERE id = OLD.id;
  END;
`);

export function getDb(): DB {
  return db;
}

export function createSession(sessionId: string): void {
  const stmt = db.prepare('INSERT INTO sessions (id) VALUES (?)');
  stmt.run(sessionId);
}

export function validateSession(sessionId: string): boolean {
  const stmt = db.prepare('SELECT created_at FROM sessions WHERE id = ?');
  const result = stmt.get(sessionId) as { created_at: string } | undefined;
  return result !== undefined;
}

export function deleteSession(sessionId: string): void {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  stmt.run(sessionId);
}

export function cleanupExpiredSessions(): void {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const stmt = db.prepare('DELETE FROM sessions WHERE created_at < ?');
  stmt.run(sevenDaysAgo);
}

export function getUserByUsername(username: string): { id: number; username: string; password_hash: string } | undefined {
  const stmt = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?');
  return stmt.get(username) as { id: number; username: string; password_hash: string } | undefined;
}

export function createUser(username: string, passwordHash: string): void {
  const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
  stmt.run(username, passwordHash);
}

export function deleteUser(username: string): void {
  const stmt = db.prepare('DELETE FROM users WHERE username = ?');
  stmt.run(username);
}
