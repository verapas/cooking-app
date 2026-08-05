import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleFavorite } from '$lib/server/queries';

// POST /api/recipes/[id]/favorite  (Schutz über Reverse Proxy, nicht auf App-Ebene)
export const POST: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    throw error(400, 'Ungültige Rezept-ID');
  }

  const success = await toggleFavorite(id);
  if (!success) {
    throw error(404, 'Rezept nicht gefunden');
  }

  return json({ ok: true });
};
