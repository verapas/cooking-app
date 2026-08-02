import { error } from '@sveltejs/kit';
import { getEffectiveImageUrl, getMainRecipeId, getRecipe, listRecipeVersions } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const recipe = getRecipe(Number(params.id));
  if (!recipe) throw error(404, 'Rezept nicht gefunden');

  const mainRecipeId = getMainRecipeId(recipe.id);
  if (!mainRecipeId) throw error(500, 'Ungültiger Rezeptstatus');
  const versions = listRecipeVersions(mainRecipeId);

  return { recipe, versions, imageUrl: getEffectiveImageUrl(recipe.id) };
};
