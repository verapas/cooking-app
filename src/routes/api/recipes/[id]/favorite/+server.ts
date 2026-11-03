import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleFavorite } from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';

// POST /api/recipes/[id]/favorite  (session-geschützt, nur eigener Space)
export const POST: RequestHandler = async ({ locals, params }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    throw error(400, 'Ungültige Rezept-ID');
  }

  const success = await toggleFavorite(requireSpaceId(locals), id);
  if (!success) {
    throw error(404, 'Rezept nicht gefunden');
  }

  return json({ ok: true });
};
