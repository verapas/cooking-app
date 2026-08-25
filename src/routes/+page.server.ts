import { listRecipes } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

// Wie viele Rezepte initial/nachgeladen werden („Mehr laden"-Button).
export const RECIPES_PAGE_SIZE = 30;

// Kategorien kommen vom Layout-Load (für den Drawer).
export const load: PageServerLoad = async () => {
  return { recipes: await listRecipes({ limit: RECIPES_PAGE_SIZE }) };
};
