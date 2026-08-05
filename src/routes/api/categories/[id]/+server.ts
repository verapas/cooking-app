import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateCategory, deleteCategory } from '$lib/server/queries';
import type { CategoryUpdateInput } from '$lib/types';

// PUT /api/categories/[id]  (Schutz über Reverse Proxy, nicht auf App-Ebene)
export const PUT: RequestHandler = async ({ params, request }) => {
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

  const success = await updateCategory(id, body);
  if (!success) {
    throw error(404, 'Kategorie nicht gefunden');
  }

  return json({ ok: true });
};

// DELETE /api/categories/[id]  (Schutz über Reverse Proxy, nicht auf App-Ebene)
export const DELETE: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    throw error(400, 'Ungültige Kategorie-ID');
  }

  const success = await deleteCategory(id);
  if (!success) {
    throw error(404, 'Kategorie nicht gefunden');
  }

  return json({ ok: true });
};
