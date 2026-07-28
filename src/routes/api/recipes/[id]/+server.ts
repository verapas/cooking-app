import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteRecipe, getRecipe, updateRecipe } from '$lib/server/queries';
import type { RecipeInput } from '$lib/types';

// GET /api/recipes/[id]  (offen)
export const GET: RequestHandler = async ({ params }) => {
  const recipe = getRecipe(Number(params.id));
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
  const ok = updateRecipe(id, body);
  if (!ok) throw error(404, 'Rezept nicht gefunden');
  return json({ id });
};

// DELETE /api/recipes/[id]  (Token-geschützt)
export const DELETE: RequestHandler = async ({ params }) => {
  const ok = deleteRecipe(Number(params.id));
  if (!ok) throw error(404, 'Rezept nicht gefunden');
  return json({ ok: true });
};
