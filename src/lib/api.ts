// === Client-Helper für API-Calls ===
//
// Wenn die Session abgelaufen ist, antwortet der Server-Guard auf /api/*
// mit 401 (JSON, kein Redirect — fetch-Klienten können mit einem
// Keycloak-Redirect nichts anfangen). Dieser Helper schickt den Browser
// dann selbst zum Login, mit Return-Path, damit man nach der Anmeldung
// wieder dort landet, wo man war.

/**
 * Prüft eine fetch-Antwort auf 401 und leitet bei Bedarf zum Login um.
 * Rückgabe: true, wenn umgeleitet wurde (Aufrufer sollte dann stoppen).
 */
export function handleUnauthorized(res: Response): boolean {
  if (res.status !== 401) return false;
  const returnTo = location.pathname + location.search;
  location.assign(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  return true;
}
