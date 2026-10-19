import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  deleteRecipe,
  deleteRecipeFamily,
  getRecipe,
  updateRecipe,
  normalizeTagNames
} from '$lib/server/queries';
import type { RecipeInput } from '$lib/types';

// GET /api/recipes/[id]  (offen)
export const GET: RequestHandler = async ({ params }) => {
  const recipe = await getRecipe(Number(params.id));
  if (!recipe) throw error(404, 'Rezept nicht gefunden');
  return json(recipe);
};

// PUT /api/recipes/[id]  (Token-geschützt)
export const PUT: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);
  let body: RecipeInput;
  try {
    body = (await request.json()) as RecipeInput;
  } catch {
    throw error(400, 'Ungültiges JSON');
  }
  if (!body?.title) throw error(422, 'Feld "title" ist erforderlich');
  body.tags = normalizeTagNames(body.tags);
  const ok = await updateRecipe(id, body);
  if (!ok) throw error(404, 'Rezept nicht gefunden');
  return json({ id });
};

// DELETE /api/recipes/[id][?scope=all]  (Schutz über Reverse Proxy)
//   scope fehlt/"version" → nur genau DIES Rezept löschen (bei einer Variante
//   bleibt die Familie erhalten; bei einem Hauptrezept mit Varianten würden
//   diese zwar per DB-Cascade mitfallen — die UI bietet dafür scope=all an).
//   scope=all → ganze Familie löschen (Hauptrezept + alle Varianten).
export const DELETE: RequestHandler = async ({ params, url }) => {
  const id = Number(params.id);
  if (isNaN(id)) throw error(400, 'Ungültige Rezept-ID');

  const ok =
    url.searchParams.get('scope') === 'all'
      ? await deleteRecipeFamily(id)
      : await deleteRecipe(id);
  if (!ok) throw error(404, 'Rezept nicht gefunden');
  return json({ ok: true });
};
