import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { seedIfEmpty, seedUser } from '$lib/server/seed';
import { validateSession, cleanupExpiredSessions } from '$lib/server/db';

const DEFAULT_PASSWORD = 'change-me-please';

let initialized = false;

function unauthorized(body: string, status: number): Response {
  return new Response(JSON.stringify({ error: body }), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

export const handle: Handle = async ({ event, resolve }) => {
  if (!initialized) {
    initialized = true;
    await seedUser();
    await seedIfEmpty();
  }

  const adminPassword = env.ADMIN_PASSWORD ?? DEFAULT_PASSWORD;

  const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/verify'];
  const isPublicPath = publicPaths.some(path => event.url.pathname.startsWith(path));

  if (!isPublicPath) {
    const sessionId = event.cookies.get('session');
    if (!sessionId || !(await validateSession(sessionId))) {
      return redirect(302, '/login');
    }
    await cleanupExpiredSessions();
  }

  const isApi = event.url.pathname.startsWith('/api/');
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(event.request.method);
  const isAuthApi = event.url.pathname.startsWith('/api/auth/');

  if (isApi && isWrite && !isAuthApi) {
    if (!adminPassword || adminPassword === DEFAULT_PASSWORD) {
      return unauthorized(
        'ADMIN_PASSWORD ist auf dem Server nicht konfiguriert.',
        503
      );
    }

    const sessionId = event.cookies.get('session');
    if (!sessionId || !(await validateSession(sessionId))) {
      return unauthorized('Unauthorized', 401);
    }

    await cleanupExpiredSessions();
  }

  return resolve(event);
};