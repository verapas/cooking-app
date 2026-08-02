import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCategoryBySlug, updateCategory, deleteCategory } from '$lib/server/queries';
import { verifySession } from '$lib/server/session';
import type { CategoryUpdateInput } from '$lib/types';

export const PUT: RequestHandler = async ({ params, cookies, request }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    throw error(400, 'Ungültige Kategorie-ID');
  }

  const session = cookies.get('session');
  if (!session || !(await verifySession(session))) {
    throw error(401, 'Unauthorized');
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

export const DELETE: RequestHandler = async ({ params, cookies }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    throw error(400, 'Ungültige Kategorie-ID');
  }

  const session = cookies.get('session');
  if (!session || !(await verifySession(session))) {
    throw error(401, 'Unauthorized');
  }

  const success = await deleteCategory(id);
  if (!success) {
    throw error(404, 'Kategorie nicht gefunden');
  }

  return json({ ok: true });
};