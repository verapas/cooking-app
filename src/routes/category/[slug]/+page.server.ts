import { error } from '@sveltejs/kit';
import { getCategoryBySlug, listRecipes } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const category = getCategoryBySlug(params.slug);
  if (!category) throw error(404, 'Kategorie nicht gefunden');
  return {
    category,
    recipes: listRecipes({ categoryId: category.id })
  };
};
