import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createRecipe, listRecipes } from '$lib/server/queries';
import type { RecipeInput } from '$lib/types';

// GET /api/recipes[?category_id=…&q=…]  (offen, kein Token nötig)
export const GET: RequestHandler = async ({ url }) => {
  const categoryId = url.searchParams.get('category_id');
  const q = url.searchParams.get('q') ?? undefined;
  const recipes = listRecipes({
    categoryId: categoryId ? Number(categoryId) : undefined,
    q: q && q.trim() ? q.trim() : undefined
  });
  return json(recipes);
};

// POST /api/recipes  (Token-geschützt)
export const POST: RequestHandler = async ({ request }) => {
  let body: RecipeInput;
  try {
    body = (await request.json()) as RecipeInput;
  } catch {
    throw error(400, 'Ungültiges JSON');
  }
  if (!body?.title || typeof body.title !== 'string') {
    throw error(422, 'Feld "title" ist erforderlich');
  }
  const id = createRecipe(body);
  return json({ id }, { status: 201 });
};
