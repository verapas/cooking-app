import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  requireAdmin,
  addMember,
  insertLocalUser,
  spaceExists,
  userExists
} from '$lib/server/admin';
import { createKeycloakUser, keycloakAdminConfigured, KeycloakAdminError } from '$lib/server/keycloakAdmin';

// POST /api/admin/users — Benutzer anlegen (nur App-Admins).
//
// Legt den Benutzer in Keycloak an (Admin-REST-API, Service-Account mit
// „manage-users"), sofort die lokale users-Zeile (sub aus dem Location-
// Header — Mitgliedschaften sind damit VOR dem ersten Login möglich) und
// optional die Mitgliedschaft in einem Space.
//
// Body:
//   { "username": "pascal",          Pflicht
//     "email": "…",                  optional
//     "name": "Vor Nach",            optional (Anzeigename)
//     "password": "geheim123",       Pflicht (temporary=true →Änderung beim 1. Login)
//     "space_id": 1 }                optional — direkt in einen Space schubsen
export const POST: RequestHandler = async ({ locals, request }) => {
  requireAdmin(locals);
  if (!keycloakAdminConfigured()) {
    throw error(503, 'Benutzer-Erstellung nicht konfiguriert (KEYCLOAK_ADMIN_CLIENT_ID/SECRET fehlen)');
  }

  let body: {
    username?: unknown;
    email?: unknown;
    name?: unknown;
    password?: unknown;
    space_id?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null;
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
  const password = typeof body.password === 'string' ? body.password : '';
  const spaceId = typeof body.space_id === 'number' ? body.space_id : null;

  if (!username) throw error(422, 'Feld "username" fehlt oder ist leer.');
  if (password.length < 6) throw error(422, 'Passwort muss mindestens 6 Zeichen haben.');

  if (spaceId != null && !(await spaceExists(spaceId))) {
    throw error(422, 'Space nicht gefunden');
  }

  try {
    const sub = await createKeycloakUser({
      username,
      email,
      // Anzeigename aufspalten (Keycloak kennt firstName/lastName, kein name)
      firstName: name?.split(' ')[0] ?? null,
      lastName: name?.split(' ').slice(1).join(' ') || null,
      password,
      temporary: true
    });
    const userId = await insertLocalUser(sub, { username, email, name });
    if (spaceId != null) {
      await addMember(spaceId, userId);
    }
    return json({ id: userId, sub }, { status: 201 });
  } catch (err) {
    if (err instanceof KeycloakAdminError) {
      throw error(502, err.message);
    }
    throw err;
  }
};
