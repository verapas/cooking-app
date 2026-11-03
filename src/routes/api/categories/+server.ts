import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCategory, listCategories } from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';
import type { CategoryInput } from '$lib/types';

// GET /api/categories — alle Kategorien des aktiven Spaces
export const GET: RequestHandler = async ({ locals }) => {
  return json(await listCategories(requireSpaceId(locals)));
};

// POST /api/categories  (session-geschützt, legt im aktiven Space an)
export const POST: RequestHandler = async ({ locals, request }) => {
  let body: CategoryInput;
  try {
    body = (await request.json()) as CategoryInput;
  } catch {
    throw error(400, 'Ungültiges JSON');
  }
  if (!body?.name || !body?.slug) {
    throw error(422, 'Felder "name" und "slug" sind erforderlich');
  }
  const id = await createCategory(requireSpaceId(locals), body);
  return json({ id }, { status: 201 });
};
