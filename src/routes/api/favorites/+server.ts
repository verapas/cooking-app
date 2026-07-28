import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFavorites } from '$lib/server/queries';

export const GET: RequestHandler = async () => {
  return json(listFavorites());
};