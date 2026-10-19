import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createTag, listTags } from '$lib/server/queries';

// GET /api/tags — alle Tags mit Familien-Zähler (Filter-Popover & Einstellungen)
export const GET: RequestHandler = async () => {
  const tags = await listTags();
  return json(tags);
};

// POST /api/tags — Tag anlegen; Body { "name": "vegetarisch" }
export const POST: RequestHandler = async ({ request }) => {
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw error(422, 'Feld "name" fehlt oder ist leer.');
  if (name.length > 40) throw error(422, 'Name ist zu lang (max. 40 Zeichen).');
  const id = await createTag(name);
  return json({ id, name }, { status: 201 });
};
