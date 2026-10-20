// === /auth/callback — OIDC-Redirect-Ziel nach dem Keycloak-Login ===
//
// Prüft State ( CSRF) und tauscht den Code mit PKCE-Verifier gegen das
// ID-Token, validiert es (JWKS/iss/aud), updatet den Benutzer, legt die
// Session an und leitet zum ursprünglich angeforderten Pfad weiter.

import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  OAUTH_REDIRECT_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  SESSION_COOKIE,
  createSession,
  exchangeCode,
  oidcConfigured,
  sanitizeReturnTo,
  sessionCookieOptions,
  upsertUser,
  validateIdToken
} from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, cookies }) => {
  if (!oidcConfigured()) {
    error(400, 'OIDC nicht konfiguriert');
  }

  // Keycloak meldet Fehler als Query-Parameter (z. B. abgebrochener Login).
  const providerError = url.searchParams.get('error');
  if (providerError) {
    error(400, `Login beim Provider fehlgeschlagen: ${providerError}`);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = cookies.get(OAUTH_STATE_COOKIE);
  const verifier = cookies.get(OAUTH_VERIFIER_COOKIE);
  if (!code || !state || !expectedState || !verifier) {
    error(400, 'Ungültiger Login-Versuch — bitte erneut versuchen.');
  }
  if (state !== expectedState) {
    error(400, 'Ungültiger Login-Versuch (State stimmt nicht überein).');
  }

  try {
    const tokens = await exchangeCode(code, `${url.origin}/auth/callback`, verifier);
    const claims = await validateIdToken(tokens.idToken);
    const userId = await upsertUser(claims);
    const token = await createSession(userId, tokens.idToken);

    cookies.set(SESSION_COOKIE, token, sessionCookieOptions(url.protocol === 'https:'));
    const returnTo = sanitizeReturnTo(cookies.get(OAUTH_REDIRECT_COOKIE)) ?? '/';
    cookies.delete(OAUTH_STATE_COOKIE, { path: '/auth' });
    cookies.delete(OAUTH_VERIFIER_COOKIE, { path: '/auth' });
    cookies.delete(OAUTH_REDIRECT_COOKIE, { path: '/auth' });

    redirect(303, returnTo);
  } catch (err) {
    console.error('OIDC-Callback fehlgeschlagen:', err);
    error(502, 'Anmeldung fehlgeschlagen — bitte erneut versuchen.');
  }
};
