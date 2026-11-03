import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSpace, requireAdmin } from '$lib/server/admin';

// POST /api/admin/spaces — Space anlegen (nur App-Admins).
// Body: { "name": "Familie" } — Kategorien sind leer; wer dort Mitglied
// wird, ergänzt sie sich (oder der Admin duppliziert sie später manuell).
export const POST: RequestHandler = async ({ locals, request }) => {
  requireAdmin(locals);
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw error(422, 'Feld "name" fehlt oder ist leer.');
  if (name.length > 100) throw error(422, 'Name ist zu lang (max. 100 Zeichen).');

  const id = await createSpace(name);
  return json({ id }, { status: 201 });
};
