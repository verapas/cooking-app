import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listRecipeVersions } from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';

// GET /api/recipes/[id]/versions  (session-geschützt, nur eigener Space)
export const GET: RequestHandler = async ({ locals, params }) => {
  const id = Number(params.id);
  const versions = await listRecipeVersions(requireSpaceId(locals), id);
  if (versions.length === 0) {
    throw error(404, 'Rezept nicht gefunden');
  }
  return json(versions);
};
