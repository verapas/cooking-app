import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createKitchenTool, listKitchenTools } from '$lib/server/queries';

// GET /api/kitchen-tools — alle Utensilien (für Einstellungen & KI-Kontext)
export const GET: RequestHandler = async () => {
  const tools = await listKitchenTools();
  return json(tools);
};

// POST /api/kitchen-tools — Utensil anlegen; Body { "name": "Airfryer" }
export const POST: RequestHandler = async ({ request }) => {
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw error(422, 'Feld "name" fehlt oder ist leer.');
  if (name.length > 80) throw error(422, 'Name ist zu lang (max. 80 Zeichen).');
  const id = await createKitchenTool(name);
  return json({ id, name }, { status: 201 });
};
