import { error } from '@sveltejs/kit';
import { getCategoryBySlug, listRecipes } from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const spaceId = requireSpaceId(locals);
  const category = await getCategoryBySlug(spaceId, params.slug);
  if (!category) throw error(404, 'Kategorie nicht gefunden');
  return {
    category,
    recipes: await listRecipes(spaceId, { categoryId: category.id })
  };
};
