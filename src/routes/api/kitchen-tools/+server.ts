import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createKitchenTool, listKitchenTools } from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';

// GET /api/kitchen-tools — alle Utensilien des aktiven Spaces
// (für Einstellungen & KI-Kontext)
export const GET: RequestHandler = async ({ locals }) => {
  const tools = await listKitchenTools(requireSpaceId(locals));
  return json(tools);
};

// POST /api/kitchen-tools — Utensil anlegen; Body { "name": "Airfryer" }
export const POST: RequestHandler = async ({ locals, request }) => {
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw error(422, 'Feld "name" fehlt oder ist leer.');
  if (name.length > 80) throw error(422, 'Name ist zu lang (max. 80 Zeichen).');
  const id = await createKitchenTool(requireSpaceId(locals), name);
  return json({ id, name }, { status: 201 });
};
