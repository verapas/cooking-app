import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// Prüft, ob der mitgegebene Bearer-Token mit COOKING_API_TOKEN übereinstimmt.
// Vom Login-Form genutzt, um den Token zu verifizieren, bevor er gespeichert wird.
export const GET: RequestHandler = async ({ request }) => {
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!env.COOKING_API_TOKEN || provided !== env.COOKING_API_TOKEN) {
    return json({ ok: false }, { status: 401 });
  }
  return json({ ok: true });
};
