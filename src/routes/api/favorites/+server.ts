import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFavorites } from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';

export const GET: RequestHandler = async ({ locals }) => {
  return json(await listFavorites(requireSpaceId(locals)));
};
