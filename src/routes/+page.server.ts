import { listRecipes } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

// Kategorien kommen vom Layout-Load (für den Drawer).
export const load: PageServerLoad = async () => {
  return { recipes: listRecipes({ limit: 50 }) };
};
