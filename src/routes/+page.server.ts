import { listRecipes } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

// Kategorien kommen vom Layout-Load (für den Drawer).
// Initial 30 Rezepte — weitere per „Mehr laden"-Button (PAGE_SIZE in +page.svelte).
export const load: PageServerLoad = async () => {
  return { recipes: await listRecipes({ limit: 30 }) };
};
