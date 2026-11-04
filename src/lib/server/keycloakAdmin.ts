// === Keycloak Admin REST API (server-only, optional) ===
//
// Ermöglicht das Anlegen von Benutzern direkt aus der App (/admin),
// statt dafür die Keycloak Admin Console zu öffnen. Voraussetzung ist
// ein eigener Confidential-Client mit Service Account und der Realm-
// Rolle „realm-management → manage-users" (Einrichtung: INFRA.md).
//
// Env ($env/dynamic/private):
//   KEYCLOAK_ADMIN_CLIENT_ID      z. B. koch-app-admin
//   KEYCLOAK_ADMIN_CLIENT_SECRET  Secret des Service-Account-Clients
// Ohne beide ist die Funktion deaktiviert (keycloakAdminConfigured()
// false) — Spaces-/Mitglieder-Verwaltung funktioniert trotzdem.
//
// Die Admin-Endpunkte werden deterministisch aus OIDC_ISSUER abgeleitet:
//   https://auth.lkit.ch/realms/master
//     → Token:  https://auth.lkit.ch/realms/master/protocol/openid-connect/token
//     → Users:  https://auth.lkit.ch/admin/realms/master/users

import { env } from '$env/dynamic/private';

const ADMIN_CLIENT_ID = env.KEYCLOAK_ADMIN_CLIENT_ID ?? null;
const ADMIN_CLIENT_SECRET = env.KEYCLOAK_ADMIN_CLIENT_SECRET ?? null;

const ISSUER = env.OIDC_ISSUER?.replace(/\/+$/, '') ?? '';

/** Basist-URL und Realm aus dem Issuer zerlegen (Issuer-Form: <base>/realms/<realm>). */
function issuerParts(): { base: string; realm: string } {
  const idx = ISSUER.indexOf('/realms/');
  if (idx < 0) throw new KeycloakAdminError('OIDC_ISSUER hat eine unerwartete Form');
  return { base: ISSUER.slice(0, idx), realm: ISSUER.slice(idx + '/realms/'.length) };
}

export function keycloakAdminConfigured(): boolean {
  return Boolean(ADMIN_CLIENT_ID && ADMIN_CLIENT_SECRET && ISSUER);
}

/** Fehler mit_keycloak-spezifischer Meldung (für die Admin-UI). */
export class KeycloakAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeycloakAdminError';
  }
}

// --- Client-Credentials-Token (gecacht) ---

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAdminToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const { base, realm } = issuerParts();
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: ADMIN_CLIENT_ID!,
    client_secret: ADMIN_CLIENT_SECRET!
  });
  const res = await fetch(`${base}/realms/${realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    cachedToken = null;
    throw new KeycloakAdminError(
      `Admin-Token konnte nicht geholt werden (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (typeof data.access_token !== 'string') {
    throw new KeycloakAdminError('Token-Antwort ohne access_token');
  }
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 60;
  cachedToken = { token: data.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return data.access_token;
}

// --- Benutzer anlegen ---

export interface KeycloakUserInput {
  username: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** Initial-Passwort; temporary=true → muss beim ersten Login geändert werden. */
  password: string;
  temporary: boolean;
}

/**
 * Legt einen Benutzer in Keycloak an und liefert dessen sub (UUID) zurück
 * — damit kann die App die lokale users-Zeile sofort anlegen und den
 * Benutzer direkt in einen Space schubsen, ohne dass er sich erst einmal
 * einloggen muss (beim ersten Login aktualisiert upsertUser nur noch).
 */
export async function createKeycloakUser(input: KeycloakUserInput): Promise<string> {
  const { base, realm } = issuerParts();
  const token = await getAdminToken();
  const res = await fetch(`${base}/admin/realms/${realm}/users`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      username: input.username,
      email: input.email || undefined,
      firstName: input.firstName || undefined,
      lastName: input.lastName || undefined,
      enabled: true,
      emailVerified: true,
      credentials:
        input.password.length > 0
          ? [{ type: 'password', value: input.password, temporary: input.temporary }]
          : undefined
    })
  });

  if (res.status === 201) {
    // Keycloak liefert die neue Benutzer-ID im Location-Header:
    //   .../admin/realms/<realm>/users/<uuid>
    const location = res.headers.get('location') ?? '';
    const sub = location.split('/').pop() ?? '';
    if (!sub) throw new KeycloakAdminError('Keycloak lieferte keine Benutzer-ID (Location-Header fehlt)');
    return sub;
  }
  if (res.status === 409) {
    throw new KeycloakAdminError('Der Benutzername existiert bereits in Keycloak.');
  }
  if (res.status === 403) {
    throw new KeycloakAdminError(
      'Keycloak verweigert das Anlegen (403) — dem Service-Account fehlt vermutlich die Rolle „manage-users".'
    );
  }
  const detail = await res.text().catch(() => '');
  throw new KeycloakAdminError(
    `Keycloak-Fehler (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`
  );
}

/**
 * Löscht einen Benutzer in Keycloak (per sub/UUID). 404 gilt als Erfolg —
 * das Konto ist dann schon weg, die lokale Zeile soll trotzdem fliegen.
 */
export async function deleteKeycloakUser(sub: string): Promise<void> {
  const { base, realm } = issuerParts();
  const token = await getAdminToken();
  const res = await fetch(`${base}/admin/realms/${realm}/users/${encodeURIComponent(sub)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` }
  });
  if (res.ok || res.status === 404) return;
  if (res.status === 403) {
    throw new KeycloakAdminError(
      'Keycloak verweigert das Löschen (403) — dem Service-Account fehlt vermutlich die Rolle „manage-users".'
    );
  }
  const detail = await res.text().catch(() => '');
  throw new KeycloakAdminError(
    `Keycloak-Fehler (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`
  );
}
