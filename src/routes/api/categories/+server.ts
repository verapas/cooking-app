import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCategory, listCategories } from '$lib/server/queries';
import type { CategoryInput } from '$lib/types';

// GET /api/categories  (offen)
export const GET: RequestHandler = async () => {
  return json(await listCategories());
};

// POST /api/categories  (Token-geschützt)
export const POST: RequestHandler = async ({ request }) => {
  let body: CategoryInput;
  try {
    body = (await request.json()) as CategoryInput;
  } catch {
    throw error(400, 'Ungültiges JSON');
  }
  if (!body?.name || !body?.slug) {
    throw error(422, 'Felder "name" und "slug" sind erforderlich');
  }
  const id = await createCategory(body);
  return json({ id }, { status: 201 });
};
