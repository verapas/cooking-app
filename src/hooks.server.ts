import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { seedIfEmpty } from '$lib/server/seed';

const DEFAULT_TOKEN = 'change-me-please';

// Einmalige Initialisierung der Datenbank (Schema passiert beim Import von
// $lib/server/db, Seed hier beim ersten Request).
let initialized = false;

/**
 * Schreibende API-Zugriffe (alles außer GET/HEAD/OPTIONS unter /api/*)
 * erfordern einen gültigen Bearer-Token. So kann Open Claw Rezepte
 * anlegen/ändern/löschen, ohne dass die App für jeden offen ist.
 */
function unauthorized(body: string, status: number): Response {
  return new Response(JSON.stringify({ error: body }), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

export const handle: Handle = async ({ event, resolve }) => {
  if (!initialized) {
    initialized = true;
    seedIfEmpty();
  }

  const isApi = event.url.pathname.startsWith('/api/');
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(event.request.method);

  if (isApi && isWrite) {
    const token = env.COOKING_API_TOKEN;
    if (!token || token === DEFAULT_TOKEN) {
      // Token auf dem Server nicht konfiguriert → Schreiben blockieren.
      return unauthorized(
        'COOKING_API_TOKEN ist auf dem Server nicht konfiguriert.',
        503
      );
    }
    const auth = event.request.headers.get('authorization') ?? '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!provided || provided !== token) {
      return unauthorized('Unauthorized', 401);
    }
  }

  return resolve(event);
};
