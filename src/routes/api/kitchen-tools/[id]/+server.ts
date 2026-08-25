import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteKitchenTool } from '$lib/server/queries';

// DELETE /api/kitchen-tools/[id] — Utensil entfernen
export const DELETE: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) throw error(400, 'Ungültige ID');
  const ok = await deleteKitchenTool(id);
  if (!ok) throw error(404, 'Utensil nicht gefunden');
  return json({ ok: true });
};
