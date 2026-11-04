// === Admin-Verwaltung (server-only, V10/Phase 2) ===
//
// Datenlage für das /admin-Panel: Benutzer- und Space-Listen inkl.
// Memberships, Space-Verwaltung (anlegen/umbenennen/löschen mit Content),
// Mitgliedschaften pflegen, aktiven Space setzen, is_admin schalten.
// AUSSCHLIESSLICH für App-Admins — jede aufrufende Route/Load prüft das
// über requireAdmin(locals).

import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { pool, toISOString, type RowDataPacket, type ResultSetHeader } from './db';
import type { AdminSpace, AdminUser, SessionUser } from '$lib/types';

/** Wirft 403, wenn der eingeloggte Benutzer kein App-Admin ist. */
export function requireAdmin(locals: App.Locals): SessionUser {
  if (!locals.user?.is_admin) {
    throw error(403, 'Kein Zugriff — nur für App-Admins');
  }
  return locals.user;
}

// =====================================================================
// Listen (für /admin)
// =====================================================================

interface UserRow extends RowDataPacket {
  id: number;
  username: string | null;
  email: string | null;
  name: string | null;
  is_admin: number | boolean;
  active_space_id: number | null;
  last_login_at: Date | string | null;
  created_at: Date | string;
}

/** Alle Benutzer mit ihren Space-Mitgliedschaften (für die Admin-UI). */
export async function listAdminUsers(): Promise<AdminUser[]> {
  const [users] = await pool.query<UserRow[]>(
    'SELECT id, username, email, name, is_admin, active_space_id, last_login_at, created_at FROM users ORDER BY created_at ASC, id ASC'
  );
  const [memberships] = await pool.query<RowDataPacket[]>(
    `SELECT sm.user_id, sm.space_id, s.name AS space_name
     FROM space_members sm JOIN spaces s ON s.id = sm.space_id
     ORDER BY s.name ASC`
  );
  const byUser = new Map<number, AdminUser['memberships']>();
  for (const m of memberships as { user_id: number; space_id: number; space_name: string }[]) {
    const list = byUser.get(m.user_id) ?? [];
    list.push({ space_id: m.space_id, space_name: m.space_name });
    byUser.set(m.user_id, list);
  }
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    is_admin: Boolean(u.is_admin),
    active_space_id: u.active_space_id != null ? Number(u.active_space_id) : null,
    last_login_at: u.last_login_at != null ? toISOString(u.last_login_at) : null,
    created_at: toISOString(u.created_at) ?? '',
    memberships: byUser.get(u.id) ?? []
  }));
}

interface SpaceRow extends RowDataPacket {
  id: number;
  name: string;
  created_at: Date | string;
  recipe_count: number;
}

/** Alle Spaces mit Mitgliedern und Rezept-Zähler (für die Admin-UI). */
export async function listAdminSpaces(): Promise<AdminSpace[]> {
  const [spaces] = await pool.query<SpaceRow[]>(
    `SELECT s.id, s.name, s.created_at,
            (SELECT COUNT(*) FROM recipes r WHERE r.space_id = s.id AND r.parent_recipe_id IS NULL) AS recipe_count
     FROM spaces s ORDER BY s.id ASC`
  );
  const [members] = await pool.query<RowDataPacket[]>(
    `SELECT sm.space_id, sm.user_id, sm.joined_at,
            u.username, u.name, u.active_space_id
     FROM space_members sm JOIN users u ON u.id = sm.user_id
     ORDER BY sm.joined_at ASC, u.id ASC`
  );
  const bySpace = new Map<number, AdminSpace['members']>();
  for (const m of members as {
    space_id: number;
    user_id: number;
    username: string | null;
    name: string | null;
    active_space_id: number | null;
  }[]) {
    const list = bySpace.get(m.space_id) ?? [];
    list.push({
      user_id: m.user_id,
      username: m.username,
      name: m.name,
      is_active_space: m.active_space_id === m.space_id
    });
    bySpace.set(m.space_id, list);
  }
  return spaces.map((s) => ({
    id: s.id,
    name: s.name,
    created_at: toISOString(s.created_at) ?? '',
    recipe_count: Number(s.recipe_count),
    members: bySpace.get(s.id) ?? []
  }));
}

// =====================================================================
// Spaces
// =====================================================================

export async function createSpace(name: string): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>('INSERT INTO spaces (name) VALUES (?)', [
    name
  ]);
  return result.insertId;
}

export async function renameSpace(id: number, name: string): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>('UPDATE spaces SET name = ? WHERE id = ?', [
    name,
    id
  ]);
  return result.affectedRows > 0;
}

export async function spaceExists(id: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM spaces WHERE id = ?', [id]);
  return rows.length > 0;
}

export async function userExists(id: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE id = ?', [id]);
  return rows.length > 0;
}

/**
 * Löscht einen Space MIT seinem gesamten Content (Rezepte inkl. Schritte/
 * Zutaten/Tags-Links, Kategorien, Tags, Utensilien). Die Memberships
 * fallen per CASCADE mit weg; users.active_space_id wird per FK auf NULL
 * gesetzt — betroffene Benutzer landen beim nächsten Request automatisch
 * in ihrem nächsten Space (bzw. bekommen einen persönlichen).
 * KI-Settings bleiben erhalten: Sie sind seit V12 nutzerspezifisch und
 * gehören nicht mehr zum Space-Content.
 */
/** Bild-URLs aller Rezepte eines Spaces (fürs Datei-Aufräumen beim
 *  Space-Löschen — VOR deleteSpace einsammeln). */
export async function listSpaceImageUrls(spaceId: number): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT image_url FROM recipes WHERE space_id = ? AND image_url IS NOT NULL',
    [spaceId]
  );
  return rows.map((r) => r.image_url as string);
}

export async function deleteSpace(id: number): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Content zuerst (FKs sind RESTRICT — ein Space mit Inhalt lässt sich
    // nicht direkt löschen). Rezept-Kinder (steps/ingredients/recipe_tags)
    // räumt der ON DELETE CASCADE auf recipes mit weg.
    await conn.execute('DELETE FROM recipes WHERE space_id = ?', [id]);
    await conn.execute('DELETE FROM categories WHERE space_id = ?', [id]);
    await conn.execute('DELETE FROM tags WHERE space_id = ?', [id]);
    await conn.execute('DELETE FROM kitchen_tools WHERE space_id = ?', [id]);
    const [result] = await conn.execute<ResultSetHeader>('DELETE FROM spaces WHERE id = ?', [id]);
    await conn.commit();
    return result.affectedRows > 0;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// =====================================================================
// Mitgliedschaften
// =====================================================================

/** Mitglied hinzufügen (idempotent — doppelte Inserts sind No-Ops). */
export async function addMember(spaceId: number, userId: number): Promise<void> {
  await pool.execute(
    'INSERT IGNORE INTO space_members (space_id, user_id) VALUES (?, ?)',
    [spaceId, userId]
  );
}

/** Mitglied entfernen. true, wenn eine Zeile gelöscht wurde. */
export async function removeMember(spaceId: number, userId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM space_members WHERE space_id = ? AND user_id = ?',
    [spaceId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Aktiven Space eines Benutzers setzen (Admin-Override, z. B. beim
 * Onboarding des Partners). Prüft die Membership — ohne gehört der Space
 * dem Benutzer nicht.
 */
export async function setActiveSpace(userId: number, spaceId: number): Promise<boolean> {
  const [member] = await pool.query<RowDataPacket[]>(
    'SELECT 1 FROM space_members WHERE space_id = ? AND user_id = ?',
    [spaceId, userId]
  );
  if (member.length === 0) return false;
  await pool.execute('UPDATE users SET active_space_id = ? WHERE id = ?', [spaceId, userId]);
  return true;
}

// =====================================================================
// Benutzer-Flags & lokale Benutzer-Zeile
// =====================================================================

/** Minimal-Datensatz eines Benutzers (fürs Löschen: Keycloak-sub etc.). */
export async function getUserBrief(
  id: number
): Promise<{ id: number; sub: string; username: string | null } | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, sub, username FROM users WHERE id = ?',
    [id]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as { id: number; sub: string; username: string | null };
  return { id: Number(row.id), sub: row.sub, username: row.username };
}

/**
 * Löscht die lokale users-Zeile. Sessions und Space-Memberships fallen
 * per CASCADE mit weg; recipes.created_by wird per FK auf NULL gesetzt —
 * Rezepte bleiben also in ihren Spaces erhalten (nur ohne Urheber-Name).
 */
export async function deleteUser(id: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

/** is_admin schalten. Eigenes Demoten verhindert die aufrufende Route. */
export async function setUserAdmin(userId: number, isAdmin: boolean): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>('UPDATE users SET is_admin = ? WHERE id = ?', [
    isAdmin ? 1 : 0,
    userId
  ]);
  return result.affectedRows > 0;
}

/**
 * Legt die lokale users-Zeile für einen per Keycloak-Admin-API erstellten
 * Benutzer an (sub aus dem Location-Header, issuer wie beim Login — der
 * upsert beim ersten Login aktualisiert dann nur noch Profildaten).
 * Läuft INSERT IGNORE: falls die Zeile doch schon existiert (sub-Kollision),
 * gewinnt die vorhandene.
 */
export async function insertLocalUser(sub: string, data: {
  username: string;
  email?: string | null;
  name?: string | null;
}): Promise<number> {
  const issuer = (env.OIDC_ISSUER ?? '').replace(/\/+$/, '');
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT IGNORE INTO users (sub, issuer, username, email, name)
     VALUES (?, ?, ?, ?, ?)`,
    [sub, issuer, data.username, data.email ?? null, data.name ?? null]
  );
  if (result.insertId > 0) return result.insertId;
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM users WHERE sub = ? AND issuer = ?',
    [sub, issuer]
  );
  return Number((rows[0] as { id: number }).id);
}
