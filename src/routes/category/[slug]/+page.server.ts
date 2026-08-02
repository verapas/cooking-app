import { error } from '@sveltejs/kit';
import { getCategoryBySlug, listRecipes } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const category = await getCategoryBySlug(params.slug);
  if (!category) throw error(404, 'Kategorie nicht gefunden');
  return {
    category,
    recipes: await listRecipes({ categoryId: category.id })
  };
};
