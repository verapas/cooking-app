import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createRecipe, listRecipes } from '$lib/server/queries';
import type { RecipeInput } from '$lib/types';

// GET /api/recipes[?category_id=…&q=…&limit=…&offset=…]  (offen, kein Token nötig)
export const GET: RequestHandler = async ({ url }) => {
  const categoryId = url.searchParams.get('category_id');
  const q = url.searchParams.get('q') ?? undefined;
  // Limit/Offset für „Mehr laden": defensiv parsen und clamping
  // (Limit 1–100, Offset ≥ 0), damit keine Blödsinn-Werte an die DB gehen.
  const limitRaw = url.searchParams.get('limit');
  const offsetRaw = url.searchParams.get('offset');
  const limit =
    limitRaw !== null ? Math.min(Math.max(Number(limitRaw) || 0, 1), 100) : undefined;
  const offset = offsetRaw !== null ? Math.max(Number(offsetRaw) || 0, 0) : undefined;
  const recipes = await listRecipes({
    categoryId: categoryId ? Number(categoryId) : undefined,
    q: q && q.trim() ? q.trim() : undefined,
    limit,
    offset
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
  if (body.parent_recipe_id && !body.version_name) {
    throw error(422, 'Feld "version_name" ist erforderlich für Varianten');
  }
  const id = await createRecipe(body);
  return json({ id }, { status: 201 });
};
