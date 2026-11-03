import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { removeMember, requireAdmin, setMemberRole } from '$lib/server/admin';
import type { SpaceRole } from '$lib/types';

// PUT /api/admin/spaces/[id]/members/[userId] — Rolle ändern (nur App-Admins).
// Body: { "role": "owner" | "member" }
export const PUT: RequestHandler = async ({ locals, params, request }) => {
  requireAdmin(locals);
  const spaceId = Number(params.id);
  const userId = Number(params.userId);
  if (!Number.isInteger(spaceId) || spaceId <= 0) throw error(400, 'Ungültige Space-ID');
  if (!Number.isInteger(userId) || userId <= 0) throw error(400, 'Ungültige Benutzer-ID');

  let body: { role?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }
  if (body.role !== 'owner' && body.role !== 'member') {
    throw error(422, '"role" muss "owner" oder "member" sein');
  }
  const ok = await setMemberRole(spaceId, userId, body.role as SpaceRole);
  if (!ok) throw error(404, 'Mitgliedschaft nicht gefunden');
  return json({ ok: true });
};

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
