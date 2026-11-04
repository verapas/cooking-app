import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { removeMember, requireAdmin } from '$lib/server/admin';

// DELETE /api/admin/spaces/[id]/members/[userId] — Mitglied entfernen
// (nur App-Admins). Der Benutzer behält seinen Account und landet beim
// nächsten Request automatisch in seinem nächsten Space (bzw. bekommt
// einen persönlichen Space, falls er sonst nirgends Mitglied ist).
export const DELETE: RequestHandler = async ({ locals, params }) => {
  requireAdmin(locals);
  const spaceId = Number(params.id);
  const userId = Number(params.userId);
  if (!Number.isInteger(spaceId) || spaceId <= 0) throw error(400, 'Ungültige Space-ID');
  if (!Number.isInteger(userId) || userId <= 0) throw error(400, 'Ungültige Benutzer-ID');

  const ok = await removeMember(spaceId, userId);
  if (!ok) throw error(404, 'Mitgliedschaft nicht gefunden');
  return json({ ok: true });
};
