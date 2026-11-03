import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRecipe, getMainRecipeId } from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';
import { getApiKey } from '$lib/server/settings';

// /chat            → Modus 'new'  (leere Session, neues Rezept)
// /chat?recipe=<id> → Modus 'improve' (bestehendes Rezept als Kontext)
//
// Im Modus 'improve' laden wir das Rezept + Hauptrezept-ID, damit der
// Chat als Kontext dient und „Als neue Version" den richtigen parent
// bekommt. Beim Modus 'new' liefern wir nur das has_key-Flag, damit die
// Seite einen Hinweis zeigen kann, falls noch kein Key gesetzt ist.
export const load: PageServerLoad = async ({ locals, url }) => {
  const spaceId = requireSpaceId(locals);
  const recipeParam = url.searchParams.get('recipe');
  const improveId = recipeParam ? Number(recipeParam) : null;

  // Wird für beide Modi gebraucht (Hinweis, falls Key fehlt).
  // KI-Settings sind nutzerspezifisch (V12) — nicht Space-scoped.
  const apiKey = await getApiKey(locals.user!.id);

  if (improveId && Number.isFinite(improveId)) {
    const recipe = await getRecipe(spaceId, improveId);
    if (!recipe) throw error(404, 'Rezept nicht gefunden.');
    const mainRecipeId = await getMainRecipeId(spaceId, recipe.id);
    if (!mainRecipeId) throw error(500, 'Ungültiger Rezeptstatus.');
    return {
      mode: 'improve' as const,
      recipeId: recipe.id,
      mainRecipeId,
      contextTitle: recipe.title,
      has_key: apiKey !== null && apiKey.trim() !== ''
    };
  }

  return {
    mode: 'new' as const,
    recipeId: null,
    mainRecipeId: null,
    contextTitle: '',
    has_key: apiKey !== null && apiKey.trim() !== ''
  };
};
