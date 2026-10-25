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

/**
 * Liest eine API-Antwort als JSON-Objekt. Die App antwortet auf /api/*
 * immer mit JSON — kommt stattdessen HTML zurück (z. B. die 504-Timeout-
 * Seite des Nginx-Proxies, wenn ein langer KI-Aufruf das Zeitlimit
 * überschreitet), wirft dieser Helper eine verständliche Meldung
 * statt „Unexpected token '<' … is not valid JSON".
 */
export async function readJson(
  res: Response
): Promise<{ error?: string; [key: string]: unknown }> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as { error?: string; [key: string]: unknown };
  } catch {
    if (res.status === 502 || res.status === 504) {
      throw new Error(
        `Der Server hat wegen Zeitüberschreitung abgebrochen (HTTP ${res.status}). ` +
          'Vermutlich hat die KI zu lange gebraucht — bitte erneut versuchen.'
      );
    }
    throw new Error(`Unerwartete Antwort vom Server (HTTP ${res.status}).`);
  }
}
