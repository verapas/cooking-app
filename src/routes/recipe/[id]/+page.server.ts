import { error } from '@sveltejs/kit';
import {
  getEffectiveImageUrl,
  getMainRecipeId,
  getRecipe,
  listRecipeVersions,
  listTags
} from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const spaceId = requireSpaceId(locals);
  const recipe = await getRecipe(spaceId, Number(params.id));
  if (!recipe) throw error(404, 'Rezept nicht gefunden');

  const mainRecipeId = await getMainRecipeId(spaceId, recipe.id);
  if (!mainRecipeId) throw error(500, 'Ungültiger Rezeptstatus');
  const versions = await listRecipeVersions(spaceId, mainRecipeId);
  const imageUrl = await getEffectiveImageUrl(spaceId, recipe.id);
  // Alle Tags (mit ID) — für verlinkbare Tag-Chips auf dem Rezept.
  const tags = await listTags(spaceId);

  return { recipe, versions, imageUrl, tags };
};
