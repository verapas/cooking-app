import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteKitchenTool } from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';

// DELETE /api/kitchen-tools/[id] — Utensil entfernen (nur eigener Space)
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) throw error(400, 'Ungültige ID');
  const ok = await deleteKitchenTool(requireSpaceId(locals), id);
  if (!ok) throw error(404, 'Utensil nicht gefunden');
  return json({ ok: true });
};
