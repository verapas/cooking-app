-- =====================================================================
-- V9__oidc_auth.sql — App-Login via OIDC (Keycloak): users + sessions
-- =====================================================================
-- Führt das App-Level-Login ein (Authorization Code Flow mit PKCE gegen
-- Keycloak, siehe src/lib/server/auth.ts). Die in V4 gedroppten Tabellen
-- kehren in neuer Form zurück — ohne Passwort-Spalten: Die Identität
-- (sub, username, email, name) kommt aus dem validierten ID-Token.
--
-- users:    eine Zeile pro (issuer, sub) — der Keycloak-Benutzer.
--           Upsert bei jedem Login (name/email können sich ändern).
-- sessions: DB-gestützte App-Sessions. id = SHA-256-Hash des Session-
--           Tokens (nur der Hash liegt in der DB, das Token nur im
--           HttpOnly-Cookie). expires_at mit Rolling-Refresh (Hook
--           verlängert, wenn weniger als die halbe TTL übrig ist).
--           id_token wird für den kompletten Logout benötigt
--           (Keycloak end_session_endpoint, id_token_hint).
--           Abgelaufene Sessions räumt createSession nebenbei ab
--           (DELETE ... WHERE expires_at < NOW(), kein Cron nötig).
-- =====================================================================

CREATE TABLE users (
  id           INT          NOT NULL AUTO_INCREMENT,
  sub          VARCHAR(255) NOT NULL,
  issuer       VARCHAR(255) NOT NULL,
  username     VARCHAR(255) NULL,
  email        VARCHAR(255) NULL,
  name         VARCHAR(255) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_issuer_sub (issuer, sub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sessions (
  id         CHAR(64)  NOT NULL,
  user_id    INT       NOT NULL,
  id_token   TEXT      NULL,
  created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
