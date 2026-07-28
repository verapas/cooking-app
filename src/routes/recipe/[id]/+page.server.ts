import { error } from '@sveltejs/kit';
import { getRecipe } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const recipe = getRecipe(Number(params.id));
  if (!recipe) throw error(404, 'Rezept nicht gefunden');
  return { recipe };
};
