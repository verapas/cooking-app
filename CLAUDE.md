# Koch-App

Mobile-first Web-App für Kochrezepte. Gebaut mit **SvelteKit + SQLite**. Läuft als
Node-Prozess (`@sveltejs/adapter-node`) — gedacht für Self-Hosting (z. B. Proxmox).
UI komplett auf Deutsch. PWA-fähig mit Offline-Unterstützung.

## Tech-Stack

- **SvelteKit 2** + **Svelte 5** (Runes: `$state`, `$derived`, `$props`, `$bindable`) + TypeScript
- **SQLite** via `better-sqlite3` (nur server-seitig, synchron)
- **adapter-node** (Produktions-Build → `node build`)
- **@vite-pwa/sveltekit** (PWA mit Service Worker)
- **bcryptjs** (Passwort-Hashing)
- **sweetalert2** (Bestätigungsdialoge)
- Package-Manager: **pnpm**

## Befehle

```bash
pnpm install     # einmalig (better-sqlite3 muss gebaut werden → s. Gotchas)
pnpm dev         # Dev-Server auf http://localhost:5173
pnpm build       # Produktions-Build nach build/ → dann `node build`
pnpm check       # Typecheck (svelte-kit sync && svelte-check)
```

## Architektur

```
src/lib/server/        # NUR server-seitig (nie vom Client importieren!)
  db.ts                # better-sqlite3-Singleton + Schema (categories→recipes→steps/ingredients)
  queries.ts           # alle Query-/Mutations-Funktionen
  seed.ts              # Beispiel-Kategorien + -Rezepte (läuft nur, wenn DB leer)
  session.ts           # Session-Validation Helper
src/lib/components/    # UI-Komponenten
  PWAInstall.svelte    # PWA-Install-Button
  OfflineIndicator.svelte # Online/Offline-Statusanzeige
src/lib/portion.ts     # Portionen-Skalierung + Mengen-/Dauer-Formatierung
src/lib/sound.ts       # Web-Audio-Bleep + Vibration (für den Stepper-Timer)
src/lib/wakeLock.ts    # Screen Wake Lock (Bildschirm beim Kochen anlassen)
src/lib/auth.svelte.ts # Client-Auth-State (Session-basiert)
src/lib/nav.svelte.ts  # Drawer-Open-State (universal reactivity)
src/lib/types.ts       # TypeScript-Typen für Rezept-Daten
src/routes/            # SvelteKit-Routing (+layout, +page, api/, images/, offline/)
  +page.svelte         # Hauptseite (Rezeptliste)
  +page.server.ts      # Load-Funktionen
  /favorites/          # Favoriten-Seite
  /offline/            # Offline-Fallback-Seite
  /login/              # Login-Seite
  /recipe/[id]/        # Rezept-Detail
  /recipe/[id]/edit/   # Rezept-Bearbeitung
  /api/                # REST-API-Endpunkte
  /images/             # Bild-Auslieferung
src/hooks.server.ts    # Seed beim Start + Session-Auth
vite.config.ts         # Vite + PWA-Konfiguration
```

## Wichtige Konventionen

- **Svelte 5 Runes**, keine alten Stores/`$:`. State aus einem Prop initialisieren →
  `untrack()` nutzen, sonst `state_referenced_locally`-Warnung:
  `let servings = $state(untrack(() => data.recipe.base_servings));`
- **DB-Zugriff immer server-only** (`src/lib/server/*`, `+page.server.ts`, `+server.ts`).
  Niemals `$lib/server/*` in Client-Komponenten importieren.
- **Session-basierte Authentifizierung**: Alle Seiten (außer `/login`) und Schreib-APIs erfordern
  eine gültige Session-Cookie. Login via `/api/auth/login` mit `ADMIN_USERNAME`/`ADMIN_PASSWORD`
  aus `.env`. Sessions werden in SQLite verwaltet und laufen nach 7 Tagen ab.

## Datenmodell

`categories` → `recipes` → `steps` + `ingredients`.
- `ingredients.quantity` muss **numerisch** sein (für Portionen-Skalierung).
  `0`/`null` = „nach Geschmack" → Menge wird ausgeblendet.
- `ingredients.step_order` ordnet eine Zutat einem Schritt zu (1-basiert nach `order`).
- `steps.duration_sec` aktiviert den Timer im Stepper.
- `recipes.image_url` wird beim Bild-Upload gesetzt (`/images/recipe-<id>-<ts>.<ext>`).
- **Rezept-Versioning**: `recipes.parent_recipe_id` (→ Hauptrezept) + `recipes.version_name`
  (z. B. "Schnelle Version", "Vegetarisch").
- **Favoriten**: `recipes.is_favorite` (0/1, wird per API getoggelt).
- **Auth-Tabellen**: `users` (username, password_hash), `sessions` (id, created_at, 7 Tage Ablauf).

## Bild-Upload & Login

- Login: `/login` (oder Drawer → „Einloggen"). Session-basiert mit `ADMIN_USERNAME`/`ADMIN_PASSWORD`
  aus `.env`. Session-Prüfung via `GET /api/auth/verify` (Cookie-basiert).
- Upload: `POST /api/recipes/[id]/image` (multipart, Feld `image`, session-geschützt).
  Speichert nach `data/images/`, setzt `image_url`, löscht das alte Bild.
  Validierung: JPG/PNG/WebP/GIF, max. 20 MB.
- Bilder ausliefern: `GET /images/[file]`.

## Seed ändern / Kategorien & Rezepte anpassen

`src/lib/server/seed.ts` läuft **nur, wenn die DB noch keine Rezepte enthält**
(`seedIfEmpty`). Um neue Demo-Daten zu erzwingen:
```bash
rm -f data/cooking.db data/cooking.db-shm data/cooking.db-wal   # beim nächsten Start neu geseedet
```

## Gotchas (Stolpersteine)

- **better-sqlite3** ist ein natives Modul. pnpm muss sein Build erlauben →
  steht in `pnpm-workspace.yaml` (`onlyBuiltDependencies: ["better-sqlite3", "canvas"]`).
  v13 liefert prebuilt Binaries mit (kein node-gyp nötig).
- **`curl` aus Git-Bash vermasselt multipart-Datei-Uploads** (HTTP 000). Zum Testen
  der Upload-API lieber Node `fetch`+`FormData` nutzen — der Browser macht es eh so.
- **Port 5173 hängt manchmal fest** (überlebende Vite-Kindprozesse). Vor `pnpm dev`
  ggf. aufräumen. Hinweis: `netstat` zeigt unter Windows-Deutsch **„ABHÖREN"**, nicht
  „LISTENING" — beim Filtern beachten.
- **Env-Variablen** (`.env`, nicht committen):
  `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `DATABASE_PATH` (default `./data/cooking.db`),
  `IMAGES_DIR` (default `./data/images`). `$env/dynamic/private` liest sie zur Runtime.
- **`Date.now()` / `Math.random()`** sind nur in Workflow-Skripten gesperrt — im
  normalen App-Code (server- wie client-seitig) frei nutzbar.

## API-Endpunkte

### Authentifizierung
- `POST /api/auth/login` - Login mit username/password (setzt Session-Cookie)
- `POST /api/auth/logout` - Logout (löscht Session)
- `GET /api/auth/verify` - Prüft ob Session gültig ist

### Kategorien
- `GET /api/categories` - Alle Kategorien (offen)
- `POST /api/categories` - Kategorie erstellen (session-geschützt)
- `PUT /api/categories/[id]` - Kategorie bearbeiten (session-geschützt)
- `DELETE /api/categories/[id]` - Kategorie löschen (session-geschützt)

### Rezepte
- `GET /api/recipes[?category_id=...&q=...]` - Rezepte suchen/listen (offen)
- `POST /api/recipes` - Rezept erstellen (session-geschützt)
- `GET /api/recipes/[id]` - Rezept-Detail (offen)
- `PUT /api/recipes/[id]` - Rezept bearbeiten (session-geschützt)
- `DELETE /api/recipes/[id]` - Rezept löschen (session-geschützt)
- `GET /api/recipes/[id]/versions` - Alle Versionen eines Rezepts (offen)
- `POST /api/recipes/[id]/favorite` - Favorit-Status umschalten (session-geschützt)
- `POST /api/recipes/[id]/image` - Bild hochladen (session-geschützt, multipart)

### Favoriten
- `GET /api/favorites` - Alle favorisierten Rezepte (offen)

### Bilder
- `GET /images/[file]` - Bild ausliefern (offen)

## Deployment (Proxmox)

```bash
pnpm build
ADMIN_USERNAME=admin ADMIN_PASSWORD=<password> DATABASE_PATH=/var/lib/cooking/db.sqlite \
  IMAGES_DIR=/var/lib/cooking/images PORT=3000 ORIGIN=https://app.example.com node build
```
Hinter einem Reverse Proxy (Nginx/Caddy) betreiben `data/` (DB + Bilder) persistent
mappen (Volume), damit Rezepte/Bilder einen Neustart überleben.

## Docker & CI

Image-Tags (via `git tag v1.0.0 && git push origin v1.0.0`):
- `:edge` — Merge auf `main` → `:edge`, `:sha-<short>`
- `v1.2.3` → `:1.2.3`, `:1.2`, `:latest` (`:latest` nur über Tag, nie per Merge)
- Deploy: `docker compose pull && up -d` (via SSH-Deploy-Workflow, bei `workflow_dispatch` ausgelöst)
- `/data` ist das Named Volume für Persistenz.
