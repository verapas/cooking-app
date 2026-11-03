import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateCategory, deleteCategory } from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';
import type { CategoryUpdateInput } from '$lib/types';

// PUT /api/categories/[id]  (session-geschützt, nur eigener Space)
export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    throw error(400, 'Ungültige Kategorie-ID');
  }

  let body: CategoryUpdateInput;
  try {
    body = (await request.json()) as CategoryUpdateInput;
  } catch {
    throw error(400, 'Ungültiges JSON');
  }

  const success = await updateCategory(requireSpaceId(locals), id, body);
  if (!success) {
    throw error(404, 'Kategorie nicht gefunden');
  }

  return json({ ok: true });
};

// DELETE /api/categories/[id]  (session-geschützt, nur eigener Space)
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    throw error(400, 'Ungültige Kategorie-ID');
  }

  const success = await deleteCategory(requireSpaceId(locals), id);
  if (!success) {
    throw error(404, 'Kategorie nicht gefunden');
  }

  return json({ ok: true });
};
