import { error } from '@sveltejs/kit';
import { getPublishedRecipe, getPublishedVersions } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

// /public/[id] — öffentliche, schreibgeschützte Ansicht eines
// veröffentlichten Rezepts (beliebiger Space). Ohne „Veröffentlichen"
// liefert die Route 404 — fremde Rezept-Details bleiben privat.
export const load: PageServerLoad = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw error(404, 'Rezept nicht gefunden');
  const recipe = await getPublishedRecipe(id);
  if (!recipe) throw error(404, 'Rezept nicht gefunden');
  // Versionen der Familie (nur veröffentlichte) für den Versions-Umschalter.
  const versions = await getPublishedVersions(id);
  return { recipe, versions };
};
