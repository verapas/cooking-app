import type { Handle } from '@sveltejs/kit';
import { json, redirect } from '@sveltejs/kit';
import { seedCategoriesIfEmpty } from '$lib/server/seed';
import { SESSION_COOKIE, getSession, refreshSession, sessionCookieOptions } from '$lib/server/auth';

// === Server-Hook: Kategorie-Seed + Login-Schutz ===
//
// 1. Beim allerersten Request die Standard-Kategorien anlegen (idempotent —
//    nur wenn die Tabelle leer ist).
// 2. App-Level-Login via OIDC (Keycloak): Session-Cookie prüfen und den
//    Benutzer in locals.user bereitstellen. Alles außer der Whitelist unten
//    erfordert eine gültige Session — Seiten bekommen einen Redirect zu
//    /auth/login, API-Routen ein 401-JSON (fetch/SSE-Klienten können mit
//    einem HTML-Redirect nichts anfangen).
let categoriesSeeded = false;

// Pfade ohne Login: die Auth-Routen selbst, die Offline-Fallback-Seite und
// die PWA-Assets — dieselbe Liste, die auch Traefik unauthentifiziert lässt
// (Router „recipes-pwa"), sonst kann der Browser die PWA nicht installieren
// bzw. der Service Worker sich nicht aktualisieren. `/_app/` (Build-Assets)
// bleibt wie bisher geschützt.
const PUBLIC_PATHS = new Set([
  '/auth/login',
  '/auth/callback',
  '/auth/logout',
  '/offline',
  '/manifest.webmanifest',
  '/sw.js',
  '/registerSW.js',
  '/robots.txt',
  '/favicon.ico',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png'
]);
const PUBLIC_PREFIXES = ['/workbox-'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export const handle: Handle = async ({ event, resolve }) => {
  if (!categoriesSeeded) {
    categoriesSeeded = true;
    try {
      await seedCategoriesIfEmpty();
    } catch (err) {
      // Falls die DB noch nicht bereit ist, nicht den ganzen Request
      // abwürgen — der nächste Versuch klappt dann.
      console.error('Kategorien-Seed fehlgeschlagen:', err);
    }
  }

  event.locals.user = null;
  const token = event.cookies.get(SESSION_COOKIE);
  if (token) {
    try {
      const session = await getSession(token);
      if (session) {
        event.locals.user = session.user;
        // Rolling: Session verlängern, wenn weniger als die halbe TTL
        // übrig ist — DB-Ablauf und Cookie zusammen (sonst stirbt das
        // Cookie vorher und die Verlängerung wäre wirkungslos).
        if (session.needsRefresh) {
          await refreshSession(token);
          event.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(event.url.protocol === 'https:'));
        }
      }
    } catch (err) {
      console.error('Session-Validierung fehlgeschlagen:', err);
    }
  }

  if (!event.locals.user && !isPublicPath(event.url.pathname)) {
    if (event.url.pathname.startsWith('/api/')) {
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }
    const returnTo = event.url.pathname + event.url.search;
    redirect(303, `/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return resolve(event);
};
