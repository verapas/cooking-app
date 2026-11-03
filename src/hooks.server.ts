import type { Handle } from '@sveltejs/kit';
import { json, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, getSession, refreshSession, sessionCookieOptions } from '$lib/server/auth';
import { resolveActiveSpace } from '$lib/server/spaces';

// === Server-Hook: Login-Schutz + aktiven Space auflösen ===
//
// 1. App-Level-Login via OIDC (Keycloak): Session-Cookie prüfen und den
//    Benutzer in locals.user bereitstellen. Alles außer der Whitelist
//    unten erfordert eine gültige Session — Seiten bekommen einen
//    Redirect zu /auth/login, API-Routen ein 401-JSON (fetch/SSE-Klienten
//    können mit einem HTML-Redirect nichts anfangen).
// 2. Aktiven Space des Benutzers in locals.space auflösen. getSession
//    liefert ihn im Regelfall gleich mit (JOIN auf space_members); nur
//    bei Erstlogin / weggefallener Membership löst resolveActiveSpace
//    auf — und provisioniert dabei ggf. einen persönlichen Space mit
//    Standard-Kategorien (der frühere globale Kategorie-Seeder ist damit
//    überflüssig: Seeding passiert pro Space bei dessen Anlage).

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
  event.locals.user = null;
  event.locals.space = null;
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

        // Aktiven Space übernehmen (getSession prüft die Membership per
        // JOIN) oder neu auflösen — inkl. Provisioning beim Erstlogin.
        if (session.space) {
          event.locals.space = session.space;
        } else {
          const displayName =
            session.user.name ?? session.user.username ?? session.user.email ?? 'Mein';
          event.locals.space = await resolveActiveSpace(session.user.id, displayName);
        }
      }
    } catch (err) {
      console.error('Session-/Space-Validierung fehlgeschlagen:', err);
    }
  }

  if (!event.locals.user && !isPublicPath(event.url.pathname)) {
    if (event.url.pathname.startsWith('/api/')) {
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }
    const returnTo = event.url.pathname + event.url.search;
    redirect(303, `/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  // Eingeloggt, aber kein Space auflösbar (z. B. DB-Fehler beim
  // Provisioning)? Dann lieber ein klarer 500er statt Queries ohne
  // Scope, die schlicht falsche Ergebnisse liefern würden.
  if (event.locals.user && !event.locals.space && !isPublicPath(event.url.pathname)) {
    if (event.url.pathname.startsWith('/api/')) {
      return json({ error: 'Space konnte nicht geladen werden' }, { status: 500 });
    }
    return new Response('Space konnte nicht geladen werden — bitte später erneut versuchen.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  return resolve(event);
};
