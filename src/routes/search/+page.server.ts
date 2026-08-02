import { searchRecipes } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const q = url.searchParams.get('q') ?? '';
  return {
    q,
    results: q.trim() ? await searchRecipes(q.trim()) : []
  };
};
