import { listRecipes, listTags } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

// Kategorien kommen vom Layout-Load (für den Drawer).
// Initial 30 Rezepte — weitere per „Mehr laden"-Button (PAGE_SIZE in +page.svelte).
// ?tag_ids=1,2 filtert initial (verlinkt von den Tag-Chips der Detailseite).
export const load: PageServerLoad = async ({ url }) => {
  const tagIds = (url.searchParams.get('tag_ids') ?? '')
    .split(',')
    .map((t) => Number(t.trim()))
    .filter((t) => Number.isInteger(t) && t > 0);

  return {
    recipes: await listRecipes({ limit: 30, tagIds: tagIds.length > 0 ? tagIds : undefined }),
    tags: await listTags(),
    initialTagIds: tagIds
  };
};
