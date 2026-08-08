# Infrastruktur

## Übersicht

```
Internet
  └─ Traefik (Reverse Proxy, TLS via Let's Encrypt)
       ├─ traefik-forward-auth (OIDC → Keycloak)
       ├─ CrowdSec (Bot/DDoS-Schutz)
       │
       ├─ recipes-redirect (Nginx Alpine → App-Container)
       │    └─ Koch-App (Node, adapter-node, Port 3000)
       │         └─ MariaDB (Datenbank)
       └─ weitere Services…
```

### Request-Flow

1. **Browser** → `https://recipes.lkit.ch` (HTTPS, TLS von Traefik/Let's Encrypt)
2. **Traefik** → prüft Router-Regeln (Host-Header, Path)
   - **PWA-Assets** (`/manifest.webmanifest`, `/sw.js`, etc.) → Router `recipes-pwa`
     → **kein Auth**, nur CrowdSec → direkt an Nginx
   - **Alles andere** → Router `recipes`
     → `traefik-forward-auth` Middleware → **Keycloak-Login** (falls kein Session-Cookie)
     → nach erfolgreicher Auth → CrowdSec → Nginx → App
3. **Nginx Alpine** (`recipes-redirect`) → reiner Proxy, leitet alles an
   `http://192.168.1.204:3000` weiter (setzt `X-Forwarded-*` Header)
4. **Koch-App** (`adapter-node`, Port 3000) → SSR-Rendering oder statische Assets
   aus `build/client/`

### Keycloak / Auth

- **OIDC-Provider:** Keycloak (`auth.lkit.ch/realms/master`)
- **Middleware:** `traefik-forward-auth` (Docker-Container)
- **Flow:** Authorization Code Flow mit Session-Cookie
- **App hat KEIN eigenes Login** — alles wird auf Infra-Ebene erledigt
  (siehe `CLAUDE.md`, „Kein App-Login mehr")
- **`hooks.server.ts`** ist ein reiner Pass-Through; alle APIs sind ungeschützt
  auf App-Ebene

## Traefik-Konfiguration (Docker-Labels)

Die Traefik-Config liegt **nicht im Repo** — sie ist Teil der Server-Infrastruktur.
Unten die Labels für die Koch-App (für Referenz / Troubleshooting).

### Services

| Service | Beschreibung |
|---|---|
| `recipes-redirect` | Nginx Alpine, reiner Reverse Proxy zur App |
| Koch-App | `node build` auf `192.168.1.204:3000` |
| `traefik-forward-auth` | OIDC-Auth-Middleware (globaler Docker-Container) |

### Traefik-Labels (recipes-redirect)

```yaml
# --- Geschützt: Alle Routes mit Auth ---
traefik.enable=true
traefik.http.routers.recipes.rule=Host(`domain.ch`)
traefik.http.routers.recipes.entrypoints=websecure
traefik.http.routers.recipes.tls=true
traefik.http.routers.recipes.tls.certresolver=letsencrypt
traefik.docker.network=external_app
traefik.http.services.recipes.loadbalancer.server.port=80
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
| **Auth** | `traefik-forward-auth` + `crowdsec` | **nur `crowdsec`** (kein Login nötig) |
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
