import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleFavorite } from '$lib/server/queries';
import { verifySession } from '$lib/server/session';

export const POST: RequestHandler = async ({ params, cookies }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    throw error(400, 'Ungültige Rezept-ID');
  }

  const session = cookies.get('session');
  if (!session || !(await verifySession(session))) {
    throw error(401, 'Unauthorized');
  }

  const success = await toggleFavorite(id);
  if (!success) {
    throw error(404, 'Rezept nicht gefunden');
  }

  return json({ ok: true });
};