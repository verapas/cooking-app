import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  countAdmins,
  deleteUser,
  getUserBrief,
  getUserRow,
  isProtectedUser,
  requireAdmin,
  setActiveSpace,
  setUserAdmin,
  userExists
} from '$lib/server/admin';
import {
  deleteKeycloakUser,
  keycloakAdminConfigured,
  KeycloakAdminError
} from '$lib/server/keycloakAdmin';

// PUT /api/admin/users/[id] — Benutzer-Flags ändern (nur App-Admins).
//
// Body (alles optional):
//   { "is_admin": true|false,      Admin-Status schalten
//     "active_space_id": 2 }       aktiven Space setzen (Membership nötig)
//
// Schutz: Der eigene Admin-Status kann nicht weggenommen werden — sonst
// sperrt man sich als letzter Admin selbst aus dem Panel aus.
export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const me = requireAdmin(locals);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw error(400, 'Ungültige Benutzer-ID');
  if (!(await userExists(id))) throw error(404, 'Benutzer nicht gefunden');

  let body: { is_admin?: unknown; active_space_id?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }

  if (body.is_admin !== undefined) {
    if (typeof body.is_admin !== 'boolean') throw error(422, '"is_admin" muss boolean sein');
    if (id === me.id && body.is_admin === false) {
      throw error(422, 'Der eigene Admin-Status kann nicht entfernt werden');
    }
    // Geschützte Konten (PROTECTED_USERS) dürfen nicht degradiert werden
    if (body.is_admin === false) {
      const brief = await getUserBrief(id);
      if (brief && isProtectedUser(id, brief.username)) {
        throw error(422, 'Dieses Konto ist geschützt und verliert seine Admin-Rechte nicht');
      }
    }
    // Guardrail „letzter Admin": Beim Entziehen prüfen, ob das Ziel
    // überhaupt Admin ist und danach noch mindestens einer übrig bliebe.
    // (Der Self-Guard oben deckt den Normalfall ab — diese Prüfung macht
    // die Invariante explizit und hält sie auch für zukünftige Codepfade.)
    if (body.is_admin === false) {
      const target = await getUserRow(id);
      if (target?.is_admin && (await countAdmins()) <= 1) {
        throw error(422, 'Der letzte Admin kann seine Rechte nicht verlieren');
      }
    }
    await setUserAdmin(id, body.is_admin);
  }

  if (body.active_space_id !== undefined) {
    if (typeof body.active_space_id !== 'number' || !Number.isInteger(body.active_space_id)) {
      throw error(422, '"active_space_id" muss eine Zahl sein');
    }
    const ok = await setActiveSpace(id, body.active_space_id);
    if (!ok) throw error(422, 'Benutzer ist kein Mitglied dieses Spaces');
  }

  return json({ ok: true });
};

// DELETE /api/admin/users/[id] — Benutzer löschen (nur App-Admins).
//
// Reihenfolge: Erst das Keycloak-Konto (per sub), dann die lokale Zeile —
// schlägt Keycloak fehl, wird NICHT lokal gelöscht, sonst loggt sich der
// Benutzer beim nächsten Login einfach neu an (upsertUser legt die Zeile
// wieder an). Selbst-Löschen ist verboten (letzter-Admin-Schutz).
// Rezepte des Benutzers bleiben in ihren Spaces (created_by → NULL),
// Sessions/Memberships fallen per CASCADE.
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const me = requireAdmin(locals);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw error(400, 'Ungültige Benutzer-ID');
  if (id === me.id) throw error(422, 'Der eigene Account kann nicht gelöscht werden');

  const user = await getUserBrief(id);
  if (!user) throw error(404, 'Benutzer nicht gefunden');
  // Geschützte Konten (PROTECTED_USERS) dürfen nie gelöscht werden —
  // z. B. der Betreiber der Keycloak-/Server-Infrastruktur.
  if (isProtectedUser(id, user.username)) {
    throw error(422, 'Dieses Konto ist geschützt und kann nicht gelöscht werden');
  }

  if (keycloakAdminConfigured()) {
    try {
      await deleteKeycloakUser(user.sub);
    } catch (err) {
      if (err instanceof KeycloakAdminError) throw error(502, err.message);
      throw err;
    }
  }
  // Ohne Admin-API-Client bleibt das Keycloak-Konto bestehen — der
  // Benutzer könnte sich wieder einloggen (lokal erscheint er dann neu).

  const ok = await deleteUser(id);
  if (!ok) throw error(404, 'Benutzer nicht gefunden');
  return json({ ok: true });
};
