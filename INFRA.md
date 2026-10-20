# Infrastruktur

## Übersicht

```
Internet
  └─ Traefik (Reverse Proxy, TLS via Let's Encrypt)
       ├─ CrowdSec (Bot/DDoS-Schutz)
       │
       ├─ recipes-redirect (Nginx Alpine → App-Container)
       │    └─ Koch-App (Node, adapter-node, Port 3000)
       │         ├─ Login: OIDC/Keycloak auf APP-Ebene (/auth/login)
       │         └─ MariaDB (Datenbank, users + sessions)
       └─ weitere Services…

Keycloak (auth.lkit.ch) wird direkt von der App angesprochen
(Authorization Code Flow + PKCE) — nicht mehr via traefik-forward-auth.
```

### Request-Flow

1. **Browser** → `https://recipes.lkit.ch` (HTTPS, TLS von Traefik/Let's Encrypt)
2. **Traefik** → prüft Router-Regeln (Host-Header, Path)
   - **PWA-Assets** (`/manifest.webmanifest`, `/sw.js`, etc.) → Router `recipes-pwa`
     → **kein Auth**, nur CrowdSec → direkt an Nginx
   - **Alles andere** → Router `recipes` → CrowdSec → Nginx → App
3. **Nginx Alpine** (`recipes-redirect`) → reiner Proxy, leitet alles an
   `http://192.168.1.204:3000` weiter (setzt `X-Forwarded-*` Header)
4. **Koch-App** (`adapter-node`, Port 3000) → **Login-Schutz in
   `hooks.server.ts`**: Ohne gültige Session-Cookie leitet die App zu
   `/auth/login` weiter (Seiten) bzw. antwortet mit `401` (APIs).
   `/auth/login` schickt den Browser zum Keycloak-Login; nach dem
   Callback (`/auth/callback`) gilt eine DB-gestützte Session
   (Rolling-TTL, Default 30 Tage — `SESSION_TTL_DAYS`).

### Keycloak / Auth (App-Level-OIDC)

- **OIDC-Provider:** Keycloak (`auth.lkit.ch/realms/master`)
- **Flow:** Authorization Code Flow mit PKCE, implementiert in
  `src/lib/server/auth.ts` (Endpunkte deterministisch aus `OIDC_ISSUER`,
  ID-Token-Validierung gegen die Keycloak-JWKS via `jose`)
- **Sessions:** DB-Tabelle `sessions` (V9) + persistentes HttpOnly-Cookie;
  in der DB liegt nur der SHA-256-Hash des Tokens. Rolling-Refresh in
  `hooks.server.ts` (verlängert, wenn < halbe TTL übrig).
- **Logout:** komplett — App-Session löschen + Keycloak-SSO via
  `end_session_endpoint` (mit `id_token_hint`, stiller Redirect zurück)
- **Fail-closed:** Ohne `OIDC_ISSUER`/`OIDC_CLIENT_ID`/`OIDC_CLIENT_SECRET`
  ist die App komplett gesperrt (Login zeigt eine Info-Seite)

#### Keycloak-Client einrichten (einmalig)

1. Keycloak Admin Console → Realm `master` → **Clients** → **Create client**
2. Client-ID: `koch-app` · Client-Protocol: `openid-connect`
3. **Client authentication: ON** (confidential → Client Secret)
4. **Standard Flow: aktiviert** (Direct Access Grants aus)
5. Valid Redirect URIs:
   - `https://recipes.lkit.ch/auth/callback` (Produktion)
   - optional `http://localhost:5173/auth/callback` + `http://localhost:3000/auth/callback` (lokale Tests)
6. Valid post logout redirect URIs: `https://recipes.lkit.ch` (bzw. `/*`)
7. Secret kopieren (Tabs „Credentials") → `OIDC_CLIENT_SECRET` in der
   `deploy/.env`

#### Empfohlene Realm-Settings (gegen ständige Re-Logins)

Realm Settings → **Sessions** (bzw. Tokens):
- **SSO Session Idle**: z. B. `30 Tage` (Default 30 min — Grund für die
  früheren ständigen Passwort-Prompts)
- **SSO Session Max**: z. B. `180 Tage`
Damit läuft der Re-Login nach App-Session-Ablauf still durch (kein Passwort).

#### App-Env (deploy/.env)

```
ORIGIN=https://recipes.lkit.ch        # Basis der Redirect-URI
OIDC_ISSUER=https://auth.lkit.ch/realms/master
OIDC_CLIENT_ID=koch-app
OIDC_CLIENT_SECRET=<aus Keycloak>
SESSION_TTL_DAYS=30                   # rolling
```

#### Umstellung von traefik-forward-auth (Phase 2)

Solange die App-Version mit App-Login **noch nicht deployed** ist, bleibt
`traefik-forward-auth` vor der App — kein Problem. Nach dem Deploy der
neuen Version **Middleware aus dem `recipes`-Router entfernen**, sonst
gibt es zwei Logos hintereinander (Doppel-Login):

```yaml
# VORHER:
traefik.http.routers.recipes.middlewares=traefik-forward-auth@docker,crowdsec-recipes@docker
# NACHHER:
traefik.http.routers.recipes.middlewares=crowdsec-recipes@docker
```

Der `recipes-pwa`-Router bleibt unverändert (nur CrowdSec).

## Traefik-Konfiguration (Docker-Labels)

Die Traefik-Config liegt **nicht im Repo** — sie ist Teil der Server-Infrastruktur.
Unten die Labels für die Koch-App (für Referenz / Troubleshooting).

### Services

| Service | Beschreibung |
|---|---|
| `recipes-redirect` | Nginx Alpine, reiner Reverse Proxy zur App |
| Koch-App | `node build` auf `192.168.1.204:3000` (Login selbst via OIDC) |
| Keycloak (`auth.lkit.ch`) | OIDC-Provider — wird direkt von der App genutzt |

### Traefik-Labels (recipes-redirect)

```yaml
# --- App-Router: CrowdSec (Auth macht die App selbst) ---
traefik.enable=true
traefik.http.routers.recipes.rule=Host(`domain.ch`)
traefik.http.routers.recipes.entrypoints=websecure
traefik.http.routers.recipes.tls=true
traefik.http.routers.recipes.tls.certresolver=letsencrypt
traefik.docker.network=external_app
traefik.http.services.recipes.loadbalancer.server.port=80
# Nach der Umstellung (s.o. „Phase 2"): nur noch crowdsec-recipes,
# traefik-forward-auth@docker entfernen.
traefik.http.routers.recipes.middlewares=traefik-forward-auth@docker,crowdsec-recipes@docker
traefik.http.middlewares.crowdsec-recipes.plugin.crowdsec-bouncer.enabled=true
traefik.http.middlewares.crowdsec-recipes.plugin.crowdsec-bouncer.crowdseclapikey=${CROWDSEC_APIKEY}

# --- PWA-Assets: OHNE Auth (höhere Priorität) ---
traefik.http.routers.recipes-pwa.rule=Host(`domain.ch`) && (Path(`/manifest.webmanifest`, `/sw.js`, `/registerSW.js`, `/robots.txt`, `/icon-192.png`, `/icon-512.png`, `/favicon.ico`, `/favicon.svg`) || PathPrefix(`/workbox-`))
traefik.http.routers.recipes-pwa.priority=100
traefik.http.routers.recipes-pwa.entrypoints=websecure
traefik.http.routers.recipes-pwa.tls=true
traefik.http.routers.recipes-pwa.tls.certresolver=letsencrypt
traefik.http.routers.recipes-pwa.middlewares=crowdsec-recipes@docker
traefik.http.routers.recipes-pwa.service=recipes
```

### Wichtig: `recipes-pwa` vs `recipes`

| | `recipes` (App) | `recipes-pwa` (PWA-Assets) |
|---|---|---|
| **Rule** | `Host(...)` → fängt alles | `Host(...) && Path(...)` → nur PWA-Files |
| **Priority** | default | `100` (wird **vor** `recipes` geprüft) |
| **Auth** | App-Level (OIDC in `hooks.server.ts`) + `crowdsec` | **gar keine** (App-Whitelist deckt dieselben Pfade ab) |
| **Service** | auto (Nginx auf Port 80) | `recipes` (gleicher Nginx) |

`PathPrefix(/workbox-)` ist nötig, weil Workbox-Dateien bei jedem Build
einen neuen Hash im Namen bekommen (`workbox-6829fd8d.js` etc.).

## PWA-Assets (unauth)

Folgende statische Dateien **müssen ohne Authentifizierung erreichbar** sein,
damit die PWA korrekt funktioniert (Service Worker, Manifest, Icons):

| Pfad | Datei | Wird generiert von |
|---|---|---|
| `/manifest.webmanifest` | Web-App-Manifest | `@vite-pwa/sveltekit` (Build) |
| `/sw.js` | Service Worker | `@vite-pwa/sveltekit` (Build) |
| `/registerSW.js` | SW-Registrierung | `@vite-pwa/sveltekit` (Build) |
| `/workbox-*.js` | Workbox-Runtime | `@vite-pwa/sveltekit` (Build) |
| `/robots.txt` | Robots-Exclusion | `static/robots.txt` (Repo) |
| `/icon-192.png` | PWA-Icon 192×192 | `static/icon-192.png` (Repo) |
| `/icon-512.png` | PWA-Icon 512×512 | `static/icon-512.png` (Repo) |
| `/favicon.ico` | Favicon | `static/favicon.ico` (Repo) |
| `/favicon.svg` | Favicon (SVG) | `static/favicon.svg` (Repo) |

### Warum ohne Auth?

- **Service Worker** muss der Browser herunterladen und registrieren können,
  **auch ohne aktive Session**. Wenn der SW-Request zum Keycloak-Redirect führt,
  kann Chrome den SW nicht installieren → die App wird nur als Verknüpfung
  (Bookmark) statt als Standalone-PWA installiert.
- **Manifest** muss geladen werden, damit Chrome die „App installieren"-UI anzeigt.
- **Icons** werden für den Installations-Dialog und den Homescreen-Eintrag gebraucht.
- Wenn ein Workbox-Update eintritt (`workbox-*.js` mit neuem Hash), muss die
  neue Datei ebenfalls ohne Auth ladbar sein — sonst bleibt der SW auf der
  alten Version.

### Troubleshooting PWA

```bash
# Prüfen ob PWA-Assets ohne Redirect ladbar sind:
curl -sI https://recipes.lkit.ch/manifest.webmanifest
# → Sollte 200 OK sein, KEIN 307 Redirect zu auth.lkit.ch

curl -sI https://recipes.lkit.ch/sw.js
# → Sollte 200 OK sein

# Content-Type prüfen:
curl -sI https://recipes.lkit.ch/manifest.webmanifest | grep content-type
# → Sollte "application/manifest+json" sein
```

In Chrome DevTools → Application:
- **Manifest**: URL sollte `/manifest.webmanifest` sein (nicht `/manifest.json`)
- **Service Workers**: Sollte „activated" sein und Status „activated and running"
- **Cache Storage**: Workbox-Caches sollten sichtbar sein
