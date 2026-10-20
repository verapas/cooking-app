// === /auth/logout — kompletter Logout (App-Session + Keycloak-SSO) ===
//
// Wird als HTML-Formular aus dem NavDrawer aufgerufen (POST). Löscht die
// App-Session und leitet zum Keycloak end_session_endpoint weiter — mit
// id_token_hint, damit Keycloak ohne Rückfrage auch die SSO-Session beendet
// und still zur App zurückleitet. Ohne id_token (oder ohne OIDC-Config)
// bleibt es beim App-only-Logout.

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  SESSION_COOKIE,
  deleteSession,
  endSessionUrl,
  getSession,
  oidcConfigured
} from '$lib/server/auth';

export const POST: RequestHandler = async ({ url, cookies }) => {
  const token = cookies.get(SESSION_COOKIE);
  let idToken: string | null = null;
  if (token) {
    idToken = (await getSession(token).catch(() => null))?.idToken ?? null;
    await deleteSession(token).catch(() => {});
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });

  if (oidcConfigured() && idToken) {
    redirect(303, endSessionUrl(idToken, `${url.origin}/`));
  }
  redirect(303, '/');
};
