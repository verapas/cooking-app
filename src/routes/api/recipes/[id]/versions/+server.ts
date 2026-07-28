import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listRecipeVersions } from '$lib/server/queries';

// GET /api/recipes/[id]/versions  (offen)
export const GET: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  const versions = listRecipeVersions(id);
  if (versions.length === 0) {
    throw error(404, 'Rezept nicht gefunden');
  }
  return json(versions);
};