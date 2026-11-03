import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin, setActiveSpace, setUserAdmin, userExists } from '$lib/server/admin';

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
