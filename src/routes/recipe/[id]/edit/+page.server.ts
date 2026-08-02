import { error } from '@sveltejs/kit';
import { getRecipe, getMainRecipeId, listRecipeVersions } from '$lib/server/queries';
import { listCategories } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const recipe = await getRecipe(Number(params.id));
  if (!recipe) throw error(404, 'Rezept nicht gefunden');

  const mainRecipeId = await getMainRecipeId(recipe.id);
  if (!mainRecipeId) throw error(500, 'Ungültiger Rezeptstatus');
  const versions = await listRecipeVersions(mainRecipeId);
  const categories = await listCategories();

  return { recipe, versions, categories };
};