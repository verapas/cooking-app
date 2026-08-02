import { listRecipes } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

// Kategorien kommen vom Layout-Load (für den Drawer).
export const load: PageServerLoad = async () => {
  return { recipes: await listRecipes({ limit: 50 }) };
};
