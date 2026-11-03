import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSpace, renameSpace, requireAdmin, spaceExists } from '$lib/server/admin';

// PUT /api/admin/spaces/[id] — Space umbenennen (nur App-Admins).
export const PUT: RequestHandler = async ({ locals, params, request }) => {
  requireAdmin(locals);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw error(400, 'Ungültige Space-ID');

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw error(422, 'Feld "name" fehlt oder ist leer.');
  if (name.length > 100) throw error(422, 'Name ist zu lang (max. 100 Zeichen).');

  const ok = await renameSpace(id, name);
  if (!ok) throw error(404, 'Space nicht gefunden');
  return json({ ok: true });
};

// DELETE /api/admin/spaces/[id] — Space MIT Content löschen (nur App-Admins).
// Löscht alle Rezepte (inkl. Schritte/Zutaten), Kategorien, Tags und Utensilien
// des Spaces; Mitglieder fallen per CASCADE heraus. KI-Settings bleiben
// erhalten (seit V12 nutzerspezifisch, gehören nicht zum Space).
export const DELETE: RequestHandler = async ({ locals, params }) => {
  requireAdmin(locals);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw error(400, 'Ungültige Space-ID');
  if (!(await spaceExists(id))) throw error(404, 'Space nicht gefunden');

  const ok = await deleteSpace(id);
  if (!ok) throw error(404, 'Space nicht gefunden');
  return json({ ok: true });
};
