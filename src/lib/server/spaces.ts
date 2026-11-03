// === Space-Verwaltung (server-only) ===
//
// Ein Space ist ein abgeschlossener Datenbereich (Rezepte, Kategorien,
// Tags, Utensilien, KI-Settings). Benutzer sind über space_members
// Mitglieder eines oder mehrerer Spaces; users.active_space_id sagt,
// welcher gerade aktiv ist.
//
// Provisioning: Beim ersten Request nach dem Login (hooks.server.ts)
// bekommt jeder Benutzer ohne Membership automatisch einen persönlichen
// Space mit den Standard-Kategorien ( früher machte das der globale
// Kategorie-Seeder in seed.ts — der ist damit überflüssig).
//
// resolveActiveSpace: aktiver Space prüfen → sonst älteste Membership
// nehmen → sonst persönlichen Space anlegen. Aktualisiert
// users.active_space_id nebenbei.

import { pool, type RowDataPacket, type ResultSetHeader } from './db';
import type { ActiveSpace, SpaceRole } from '$lib/types';

/**
 * Space-ID aus locals (für Load-Funktionen und API-Routen). Der Hook
 * garantiert für alle nicht-öffentlichen Pfade einen aktiven Space —
 * dieser Helper macht das für TypeScript greifbar (sonst 500).
 */
export function requireSpaceId(locals: App.Locals): number {
  if (!locals.space) throw new Error('Kein aktiver Space auflösbar');
  return locals.space.id;
}

/** Standard-Kategorien für frische Spaces (ehemals seed.ts). */
const DEFAULT_CATEGORIES: { name: string; slug: string; icon: string; sort_order: number }[] = [
  { name: 'Suppen', slug: 'suppen', icon: 'soup', sort_order: 1 },
  { name: 'Salate', slug: 'salate', icon: 'salad', sort_order: 2 },
  { name: 'Brot & Backwerk', slug: 'brot-backwerk', icon: 'bread', sort_order: 3 },
  { name: 'Pasta', slug: 'pasta', icon: 'pasta', sort_order: 4 },
  { name: 'Hauptgerichte', slug: 'hauptgerichte', icon: 'plate', sort_order: 5 },
  { name: 'Desserts', slug: 'desserts', icon: 'cake', sort_order: 6 },
  { name: 'Snacks', slug: 'snacks', icon: 'snack', sort_order: 7 }
];

/**
 * Legt einen persönlichen Space für den Benutzer an: Space + owner-
 * Membership + Standard-Kategorien, atomar. Name ist am Anzeigenamen
 * orientiert ("Pascals Rezepte"); umbenennbar (Phase 2 / SQL).
 */
export async function createPersonalSpace(
  userId: number,
  displayName: string
): Promise<ActiveSpace> {
  const clean = displayName.trim() || 'Mein';
  const name = `${clean}s Rezepte`;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute<ResultSetHeader>(
      'INSERT INTO spaces (name) VALUES (?)',
      [name]
    );
    const spaceId = result.insertId;
    await conn.execute(
      'INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, ?)',
      [spaceId, userId, 'owner']
    );
    for (const c of DEFAULT_CATEGORIES) {
      await conn.execute(
        'INSERT INTO categories (space_id, name, slug, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
        [spaceId, c.name, c.slug, c.icon, c.sort_order]
      );
    }
    await conn.commit();
    return { id: spaceId, name, role: 'owner' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Löst den aktiven Space eines Benutzers auf:
 *   1. users.active_space_id, sofern die Membership noch besteht
 *      (kann weggefallen sein — Space gelöscht / herausgeworfen)
 *   2. sonst: älteste Membership
 *   3. sonst: persönlicher Space (Erstlogin)
 * Schreibt das Ergebnis in users.active_space_id zurück.
 */
export async function resolveActiveSpace(
  userId: number,
  displayName: string
): Promise<ActiveSpace> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id, s.name, sm.role
     FROM users u
     JOIN space_members sm ON sm.user_id = u.id
     JOIN spaces s ON s.id = sm.space_id
     WHERE u.id = ?
     ORDER BY (s.id = u.active_space_id) DESC, sm.joined_at ASC, s.id ASC
     LIMIT 1`,
    [userId]
  );

  let space: ActiveSpace;
  if (rows.length > 0) {
    const row = rows[0];
    space = {
      id: Number(row.id),
      name: row.name as string,
      role: (row.role as SpaceRole) ?? 'member'
    };
  } else {
    space = await createPersonalSpace(userId, displayName);
  }

  await pool
    .execute('UPDATE users SET active_space_id = ? WHERE id = ?', [space.id, userId])
    .catch((err) => console.error('active_space_id-Update fehlgeschlagen:', err));

  return space;
}
