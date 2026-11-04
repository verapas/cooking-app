import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addMember, requireAdmin, spaceExists, userExists } from '$lib/server/admin';

// POST /api/admin/spaces/[id]/members — Mitglied hinzufügen (nur App-Admins).
// Body: { "user_id": 3 }. Existierende Mitgliedschaft: No-Op (idempotent).
export const POST: RequestHandler = async ({ locals, params, request }) => {
  requireAdmin(locals);
  const spaceId = Number(params.id);
  if (!Number.isInteger(spaceId) || spaceId <= 0) throw error(400, 'Ungültige Space-ID');
  if (!(await spaceExists(spaceId))) throw error(404, 'Space nicht gefunden');

  let body: { user_id?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }
  const userId = typeof body.user_id === 'number' ? body.user_id : NaN;
  if (!Number.isInteger(userId) || userId <= 0) throw error(422, '"user_id" fehlt oder ist ungültig');
  if (!(await userExists(userId))) throw error(404, 'Benutzer nicht gefunden');

  await addMember(spaceId, userId);
  return json({ ok: true }, { status: 201 });
};
