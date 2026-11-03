import { listPublishedRecipes } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

// /public — veröffentlichte Rezepte aller Spaces (für alle eingeloggten
// Benutzer). ?q= filtert auf Titel/Beschreibung.
export const load: PageServerLoad = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim() ?? '';
  return {
    recipes: await listPublishedRecipes(q || undefined),
    q
  };
};
