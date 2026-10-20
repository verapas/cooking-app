// === App-Login: OIDC (Keycloak) + DB-gestützte Sessions ===
//
// Authorization Code Flow mit PKCE, komplett ohne Zusatz-Bibliothek:
// URL-Bau und Token-Exchange von Hand (Node crypto), ID-Token-Validierung
// gegen die Keycloak-JWKS via `jose`. Die Endpunkte werden deterministisch
// aus OIDC_ISSUER abgeleitet (Standard-Keycloak-Pfade) — ein Discovery-
// Request ist dafür nicht nötig.
//
// Sessions: 32-Byte-Random-Token im HttpOnly-Cookie; in der DB liegt nur
// der SHA-256-Hash. Rolling-Refresh: Der Hook verlängert die Session, wenn
// weniger als die halbe TTL übrig ist (TTL via SESSION_TTL_DAYS, Default 30).
//
// Env ($env/dynamic/private, wie db.ts):
//   OIDC_ISSUER       z. B. https://auth.lkit.ch/realms/master
//   OIDC_CLIENT_ID    z. B. koch-app (Keycloak-Client, confidential)
//   OIDC_CLIENT_SECRET  Secret des Keycloak-Clients
//   SESSION_TTL_DAYS  Session-Dauer in Tagen (Default 30, rolling)

import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '$env/dynamic/private';
import { pool, type ResultSetHeader, type RowDataPacket } from './db';
import type { SessionUser } from '$lib/types';

// --- Konfiguration ---
const ISSUER = env.OIDC_ISSUER?.replace(/\/+$/, '') ?? null;
const CLIENT_ID = env.OIDC_CLIENT_ID ?? null;
const CLIENT_SECRET = env.OIDC_CLIENT_SECRET ?? null;

export const SESSION_TTL_DAYS = Math.max(1, Number(env.SESSION_TTL_DAYS ?? '30') || 30);
const SESSION_TTL_SEC = SESSION_TTL_DAYS * 86400;

export const SESSION_COOKIE = 'koch_session';
// Kurzzeit-Cookies für den OAuth-Handshake (nur unter /auth/ relevant).
export const OAUTH_STATE_COOKIE = 'koch_oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'koch_oauth_verifier';
export const OAUTH_REDIRECT_COOKIE = 'koch_oauth_redirect';

export function oidcConfigured(): boolean {
  return Boolean(ISSUER && CLIENT_ID && CLIENT_SECRET);
}

// --- Keycloak-Endpunkte (deterministisch aus dem Issuer) ---
const endpoints = ISSUER
  ? {
      auth: `${ISSUER}/protocol/openid-connect/auth`,
      token: `${ISSUER}/protocol/openid-connect/token`,
      logout: `${ISSUER}/protocol/openid-connect/logout`,
      certs: `${ISSUER}/protocol/openid-connect/certs`
    }
  : null;

// JWKS-Set wird von jose gecached und bei Schlüsselwechsel erneuert.
const jwks = endpoints ? createRemoteJWKSet(new URL(endpoints.certs)) : null;

// =====================================================================
// OAuth/PKCE-Bausteine
// =====================================================================

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** PKCE-Paar: Verifier (Cookie) + Challenge (S256, an Keycloak geschickt). */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken();
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function authorizationUrl(redirectUri: string, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  return `${endpoints!.auth}?${params.toString()}`;
}

/** Kompletter Logout: Keycloak beendet auch die SSO-Session (id_token_hint). */
export function endSessionUrl(idToken: string, postLogoutUri: string): string {
  const params = new URLSearchParams({
    id_token_hint: idToken,
    post_logout_redirect_uri: postLogoutUri
  });
  return `${endpoints!.logout}?${params.toString()}`;
}

// =====================================================================
// Token-Exchange + ID-Token-Validierung
// =====================================================================

export interface OidcTokens {
  idToken: string;
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  verifier: string
): Promise<OidcTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    code_verifier: verifier
  });
  const res = await fetch(endpoints!.token, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body
  });
  if (!res.ok) {
    throw new Error(`Token-Endpunkt antwortete mit ${res.status}`);
  }
  const data = (await res.json()) as { id_token?: unknown };
  if (typeof data.id_token !== 'string') {
    throw new Error('Token-Antwort ohne id_token');
  }
  return { idToken: data.id_token };
}

/** Claims aus dem validierten ID-Token (Signatur via JWKS, iss + aud geprüft). */
export interface KeycloakClaims {
  sub: string;
  preferred_username?: string;
  email?: string;
  name?: string;
}

export async function validateIdToken(idToken: string): Promise<KeycloakClaims> {
  if (!jwks) throw new Error('OIDC nicht konfiguriert');
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: ISSUER!,
    audience: CLIENT_ID!
  });
  if (typeof payload.sub !== 'string') throw new Error('ID-Token ohne sub-Claim');
  return {
    sub: payload.sub,
    preferred_username:
      typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined
  };
}

// =====================================================================
// User + Session (DB)
// =====================================================================

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Legt den Keycloak-Benutzer an bzw. aktualisiert Profil + last_login_at. */
export async function upsertUser(claims: KeycloakClaims): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users (sub, issuer, username, email, name, last_login_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       username = VALUES(username), email = VALUES(email),
       name = VALUES(name), last_login_at = NOW()`,
    [claims.sub, ISSUER, claims.preferred_username ?? null, claims.email ?? null, claims.name ?? null]
  );
  if (result.insertId > 0) return result.insertId;
  // ON DUPLICATE KEY liefert insertId 0 → existierende id nachlesen
  // (gleiches Muster wie createTag in queries.ts).
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM users WHERE issuer = ? AND sub = ?',
    [ISSUER, claims.sub]
  );
  return Number(rows[0].id);
}

/** Session anlegen; zurück kommt das Token fürs Cookie. */
export async function createSession(userId: number, idToken: string): Promise<string> {
  const token = randomToken();
  await pool.execute(
    'INSERT INTO sessions (id, user_id, id_token, expires_at) VALUES (?, ?, ?, ?)',
    [hashToken(token), userId, idToken, new Date(Date.now() + SESSION_TTL_SEC * 1000)]
  );
  // Abgelaufene Sessions nebenbei entsorgen (fehler-tolerant, kein Cron).
  pool.execute('DELETE FROM sessions WHERE expires_at < NOW()').catch(() => {});
  return token;
}

export interface SessionRecord {
  user: SessionUser;
  /** Für den kompletten Logout (id_token_hint) — siehe /auth/logout. */
  idToken: string | null;
  /** true, wenn die Restlaufzeit unter der Hälfte der TTL liegt (rolling). */
  needsRefresh: boolean;
}

export async function getSession(token: string): Promise<SessionRecord | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id_token, s.expires_at, u.id AS uid, u.username, u.email, u.name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > NOW()`,
    [hashToken(token)]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  const expiresAt =
    row.expires_at instanceof Date ? row.expires_at.getTime() : new Date(String(row.expires_at)).getTime();
  return {
    user: {
      id: Number(row.uid),
      username: (row.username as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      name: (row.name as string | null) ?? null
    },
    idToken: (row.id_token as string | null) ?? null,
    needsRefresh: expiresAt - Date.now() < (SESSION_TTL_SEC * 1000) / 2
  };
}

/** Rolling-Refresh: Ablaufdatum der Session auf jetzt + TTL setzen. */
export async function refreshSession(token: string): Promise<void> {
  await pool.execute('UPDATE sessions SET expires_at = ? WHERE id = ?', [
    new Date(Date.now() + SESSION_TTL_SEC * 1000),
    hashToken(token)
  ]);
}

export async function deleteSession(token: string): Promise<void> {
  await pool.execute('DELETE FROM sessions WHERE id = ?', [hashToken(token)]);
}

// =====================================================================
// Cookie-Optionen
// =====================================================================

/** Persistentes Session-Cookie (überlebt App-Neustart/Handy-Reboot — PWA). */
export function sessionCookieOptions(secure: boolean) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: SESSION_TTL_SEC
  } as const;
}

/**
 * Nur interne Pfade als Redirect-Ziel erlauben (Open-Redirect-Guard):
 * muss mit "/" beginnen, aber nicht mit "//" (protocol-relative URL).
 */
export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}
