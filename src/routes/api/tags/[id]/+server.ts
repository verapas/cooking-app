import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteTag, renameTag } from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';

// PUT /api/tags/[id] — Tag umbenennen; Body { "name": "…" }
export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const id = Number(params.id);
  if (isNaN(id)) throw error(400, 'Ungültige Tag-ID');

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw error(422, 'Feld "name" fehlt oder ist leer.');
  if (name.length > 40) throw error(422, 'Name ist zu lang (max. 40 Zeichen).');

  const ok = await renameTag(requireSpaceId(locals), id, name);
  if (!ok) throw error(404, 'Tag nicht gefunden');
  return json({ id, name });
};

// DELETE /api/tags/[id] — Tag löschen (Verknüpfungen fallen per CASCADE weg)
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const id = Number(params.id);
  if (isNaN(id)) throw error(400, 'Ungültige Tag-ID');

  const ok = await deleteTag(requireSpaceId(locals), id);
  if (!ok) throw error(404, 'Tag nicht gefunden');
  return json({ ok: true });
};
