// === /auth/login — Einstieg in den OIDC-Flow (Redirect zu Keycloak) ===
//
// Setzt State + PKCE-Verifier + Return-Pfad in Kurzzeit-Cookies (10 min,
// nur unter /auth/) und leitet zur Keycloak-Login-Seite weiter. Die echte
// Login-Seite rendert Keycloak selbst — hier gibt es bewusst keine eigene.

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  OAUTH_REDIRECT_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  SESSION_COOKIE,
  authorizationUrl,
  getSession,
  oidcConfigured,
  pkcePair,
  randomToken,
  sanitizeReturnTo
} from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, cookies }) => {
  // Bereits angemeldet? Direkt zur App.
  const existing = cookies.get(SESSION_COOKIE);
  if (existing && (await getSession(existing).catch(() => null))) {
    redirect(303, sanitizeReturnTo(url.searchParams.get('returnTo')) ?? '/');
  }

  // Ohne OIDC-Konfiguration: Info-Seite statt Login (kein 503 — der
  // Docker-Healthcheck läuft über / und landet sonst in einer Fehlerkette).
  if (!oidcConfigured()) {
    return new Response(
      `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Anmeldung nicht konfiguriert – Koch-App</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #15110d; color: #f5ede2; font-family: system-ui, sans-serif; }
  .box { max-width: 420px; padding: 32px 24px; text-align: center; }
  h1 { font-size: 1.2rem; }
  p { color: #b3a695; line-height: 1.6; font-size: 0.95rem; }
  code { color: #ff7a3d; font-size: 0.85rem; }
</style>
</head>
<body>
  <div class="box">
    <h1>Anmeldung nicht konfiguriert</h1>
    <p>Die App erwartet einen Login über Keycloak (OIDC), aber es fehlen
    Umgebungsvariablen:</p>
    <p><code>OIDC_ISSUER</code>, <code>OIDC_CLIENT_ID</code>,
    <code>OIDC_CLIENT_SECRET</code></p>
    <p>Einrichtung: siehe <code>INFRA.md</code> (Abschnitt Keycloak).</p>
  </div>
</body>
</html>`,
      { headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  const state = randomToken();
  const { verifier, challenge } = pkcePair();
  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));

  const oauthCookie = {
    path: '/auth',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: 600
  } as const;
  cookies.set(OAUTH_STATE_COOKIE, state, oauthCookie);
  cookies.set(OAUTH_VERIFIER_COOKIE, verifier, oauthCookie);
  cookies.set(OAUTH_REDIRECT_COOKIE, returnTo ?? '', oauthCookie);

  redirect(302, authorizationUrl(`${url.origin}/auth/callback`, state, challenge));
};
