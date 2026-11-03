import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  createRecipe,
  listRecipes,
  normalizeTagNames,
  recipeExistsInSpace
} from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';
import type { RecipeInput } from '$lib/types';

// GET /api/recipes[?category_id=…&q=…&tag_ids=1,2&limit=…&offset=…]
// (session-geschützt; liefert nur Rezepte des aktiven Spaces)
export const GET: RequestHandler = async ({ locals, url }) => {
  const spaceId = requireSpaceId(locals);
  const categoryId = url.searchParams.get('category_id');
  const q = url.searchParams.get('q') ?? undefined;
  // Tag-Filter (UND über die Rezept-Familie): "tag_ids=1,2"
  const tagIdsRaw = url.searchParams.get('tag_ids');
  const tagIds =
    tagIdsRaw
      ?.split(',')
      .map((t) => Number(t.trim()))
      .filter((t) => Number.isInteger(t) && t > 0) ?? [];
  // Limit/Offset für „Mehr laden": defensiv parsen und clamping
  // (Limit 1–100, Offset ≥ 0), damit keine Blödsinn-Werte an die DB gehen.
  const limitRaw = url.searchParams.get('limit');
  const offsetRaw = url.searchParams.get('offset');
  const limit =
    limitRaw !== null ? Math.min(Math.max(Number(limitRaw) || 0, 1), 100) : undefined;
  const offset = offsetRaw !== null ? Math.max(Number(offsetRaw) || 0, 0) : undefined;
  const recipes = await listRecipes(spaceId, {
    categoryId: categoryId ? Number(categoryId) : undefined,
    q: q && q.trim() ? q.trim() : undefined,
    tagIds: tagIds.length > 0 ? tagIds : undefined,
    limit,
    offset
  });
  return json(recipes);
};

// POST /api/recipes  (session-geschützt; Rezept landet im aktiven Space)
export const POST: RequestHandler = async ({ locals, request }) => {
  const spaceId = requireSpaceId(locals);
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
  // Varianten dürfen nur auf ein Hauptrezept im SELBEN Space hängen
  // (sonst könnte man per parent_recipe_id fremde Spaces referenzieren).
  if (body.parent_recipe_id != null && !(await recipeExistsInSpace(spaceId, body.parent_recipe_id))) {
    throw error(422, 'Elternrezept nicht gefunden');
  }
  body.tags = normalizeTagNames(body.tags);
  const id = await createRecipe(spaceId, body, locals.user?.id ?? null);
  return json({ id }, { status: 201 });
};
