import {
  listPublishedCategories,
  listPublishedRecipes,
  listPublishedTags
} from '$lib/server/queries';
import type { PageServerLoad } from './$types';

// /public — veröffentlichte Rezepte aller Spaces (für alle eingeloggten
// Benutzer). Filter via URL-Parameter (kombinierbar):
//   ?q=            Titel/Beschreibung
//   ?tags=a,b      Tag-Namen, UND-verknüpft (direkt am Rezept)
//   ?category=...  exakter Kategoriename
// Tag-/Kategorie-Optionen (mit Zählern) kommen aus demselben Load.
export const load: PageServerLoad = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim() ?? '';
  const tagNames = (url.searchParams.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const categoryName = url.searchParams.get('category')?.trim() ?? '';

  const [recipes, tags, categories] = await Promise.all([
    listPublishedRecipes({
      q: q || undefined,
      tagNames: tagNames.length > 0 ? tagNames : undefined,
      categoryName: categoryName || undefined
    }),
    listPublishedTags(),
    listPublishedCategories()
  ]);

  return {
    recipes,
    q,
    initialTagNames: tagNames,
    initialCategory: categoryName,
    tags,
    categories
  };
};
