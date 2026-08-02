# Koch-App

Mobile-first Web-App für Kochrezepte. Gebaut mit **SvelteKit + MariaDB**. Läuft als
Node-Prozess (`@sveltejs/adapter-node`) — gedacht für Self-Hosting (z. B. Proxmox).
UI komplett auf Deutsch. PWA-fähig mit Offline-Unterstützung.

## Tech-Stack

- **SvelteKit 2** + **Svelte 5** (Runes: `$state`, `$derived`, `$props`, `$bindable`) + TypeScript
- **MariaDB** via `mysql2` (async, Connection-Pool)
- **Flyway** (Schema-Migration via separatem Container beim Deploy, s. Docker-Abschnitt)
- **adapter-node** (Produktions-Build → `node build`)
- **@vite-pwa/sveltekit** (PWA mit Service Worker)
- **bcryptjs** (Passwort-Hashing)
- **sweetalert2** (Bestätigungsdialoge)
- Package-Manager: **pnpm**

## Befehle

```bash
pnpm install     # einmalig (canvas muss gebaut werden → s. Gotchas)
pnpm dev         # Dev-Server auf http://localhost:5173 (braucht externe MariaDB!)
pnpm build       # Produktions-Build nach build/ → dann `node build`
pnpm check       # Typecheck (svelte-kit sync && svelte-check)

# Docker (lokaler Fullstack-Test: mariadb + migrator + app):
pnpm docker:dev    # Image bauen + Stack starten (detached). App auf :3000
pnpm docker:logs   # Live-Logs aller Services (Strg+C zum Beenden, stoppt nichts)
pnpm docker:down   # Stack stoppen, Volumes bleiben erhalten (Daten überleben)
pnpm docker:reset  # Stack stopfen + DB-Volumes löschen → nächster Start resettet
```

**Wichtig zu `pnpm dev`**: Dieser Start läuft OHNE MariaDB-Container und wird beim
ersten DB-Zugriff scheitern. Für lokale Entwicklung entweder (a) eine externe
MariaDB-Instanz laufen lassen (Env-Vars `DB_HOST` etc. setzen) oder (b) den
vollen Stack via `pnpm docker:dev` starten und dann Code-Änderungen an der App
per `pnpm dev` testen (die App verbindet sich dann gegen die dockerisierte DB,
dafür `DB_HOST=127.0.0.1` und in `compose.dev.yaml` den Port 3306 freigeben).

## Architektur

```
src/lib/server/        # NUR server-seitig (nie vom Client importieren!)
  db.ts                # mysql2-Pool (Singleton) + Auth-/Session-Helper (alle async)
  queries.ts           # alle Query-/Mutations-Funktionen (alle async)
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
  +page.server.ts      # Load-Funktionen (await Query-Calls)
  /favorites/          # Favoriten-Seite
  /offline/            # Offline-Fallback-Seite
  /login/              # Login-Seite
  /recipe/[id]/        # Rezept-Detail
  /recipe/[id]/edit/   # Rezept-Bearbeitung
  /api/                # REST-API-Endpunkte
  /images/             # Bild-Auslieferung
src/hooks.server.ts    # Seed beim Start + Session-Auth
db/migration/          # Flyway-SQL-Scripts (V1__init_schema.sql etc.) — vom
                       # Flyway-Container beim Deploy eingelesen, nicht von der App
vite.config.ts         # Vite + PWA-Konfiguration
```

## Wichtige Konventionen

- **Svelte 5 Runes**, keine alten Stores/`$:`. State aus einem Prop initialisieren →
  `untrack()` nutzen, sonst `state_referenced_locally`-Warnung:
  `let servings = $state(untrack(() => data.recipe.base_servings));`
- **DB-Zugriff immer server-only** (`src/lib/server/*`, `+page.server.ts`, `+server.ts`).
  Niemals `$lib/server/*` in Client-Komponenten importieren.
- **Alle Query-/Auth-Funktionen sind async** (mysql2-Pool). Aufrufe in Load-Funktionen
  und API-Routen müssen `await` sein — sonst erhält man Promises statt Daten.
- **Session-basierte Authentifizierung**: Alle Seiten (außer `/login`) und Schreib-APIs erfordern
  eine gültige Session-Cookie. Login via `/api/auth/login` mit `ADMIN_USERNAME`/`ADMIN_PASSWORD`
  aus `.env`. Sessions werden in MariaDB verwaltet und laufen nach 7 Tagen ab.
- **Schema-Änderungen NUR über Flyway** (`db/migration/V*__*.sql`). Nie manuell mit
  `ALTER TABLE` in `db.ts` — Flyway checksummt die Files und ein manueller Eingriff
  macht die History inkonsistent.

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
  Speichert nach `$IMAGES_DIR` (default `/data/images` im Container bzw.
  `./data/images` lokal), setzt `image_url`, löscht das alte Bild.
  Validierung: JPG/PNG/WebP/GIF, max. 20 MB.
- Bilder ausliefern: `GET /images/[file]`.

## Seed ändern / Kategorien & Rezepte anpassen

`src/lib/server/seed.ts` läuft **nur, wenn die DB noch keine Rezepte enthält**
(`seedIfEmpty`). Um neue Demo-Daten zu erzwingen:
```bash
pnpm docker:reset   # stoppt den Stack und löscht die MariaDB-Volumes
pnpm docker:dev     # beim nächsten Start wird frisch geseeedet
```

## Gotchas (Stolpersteine)

- **`canvas`** ist ein natives Modul (wird für PWA-Icon-Generierung im Build gebraucht).
  pnpm muss seinen Build explizit erlauben → steht in `pnpm-workspace.yaml`
  (`allowBuilds: { canvas: true }` + `onlyBuiltDependencies: ["canvas"]`).
  mysql2 ist reines JS und braucht keinen Native-Build.
- **mysql2 liefert `Date` und `Boolean`**, keine Strings/Numbers wie better-sqlite3.
  `DATETIME`-Spalten kommen als `Date`-Objekt, `TINYINT(1)` als echtes Boolean.
  Zentrale Row-Mapper in `db.ts` (`normalizeDates`, `toISOString`) wandeln das
  zurück in die TS-Typen (`string`, etc.) — damit die Client-Komponenten stabil
  bleiben. Neue Datumsspalten müssen in `RECIPE_DATES` etc. ergänzt werden.
- **`"order"` ist in MariaDB reserviert** → in SQL-Statements zwingend backticken
  (`` `order` ``), sonst Syntax-Fehler. Queries in `queries.ts` machen das bereits.
- **`curl` aus Git-Bash vermasselt multipart-Datei-Uploads** (HTTP 000). Zum Testen
  der Upload-API lieber Node `fetch`+`FormData` nutzen — der Browser macht es eh so.
- **Port 5173 hängt manchmal fest** (überlebende Vite-Kindprozesse). Vor `pnpm dev`
  ggf. aufräumen. Hinweis: `netstat` zeigt unter Windows-Deutsch **„ABHÖREN"**, nicht
  „LISTENING" — beim Filtern beachten.
- **Env-Variablen** (`.env`, nicht committen):
  `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `DB_HOST` (default `localhost`),
  `DB_PORT` (default `3306`), `DB_NAME` (default `cooking`), `DB_USER` (default `cooking`),
  `DB_PASSWORD`, `IMAGES_DIR` (default `./data/images`). `$env/dynamic/private` liest
  sie zur Runtime.
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

Produktiv läuft die App ausschließlich als Docker-Compose-Stack (siehe
„Docker & CI" unten). Ein direkter `node build`-Start ist nur für lokale
Tests relevant — dabei muss eine MariaDB erreichbar sein (Env-Variablen
`DB_HOST` etc.) und das Schema muss manuell via Flyway-CLI oder durch
`db/migration/V1__init_schema.sql` angelegt worden sein.

## Docker & CI

**Zwei Compose-Dateien mit klar getrennten Zwecken:**
- `compose.dev.yaml` (Repo-Root) — **lokal**: baut das Image aus dem Dockerfile
  (`build: .`), startet mariadb + migrator + app. Aufruf via `pnpm docker:dev`.
- `deploy/compose.example.yaml` — **Produktion**: referenziert ein fertiges Image
  aus GHCR (`image: ghcr.io/OWNER/REPO:edge`). Wird nach `deploy/compose.yaml`
  kopiert und mit echten Werten gefüllt.

**Drei Services** in beiden Compose-Files:
`mariadb` (DB) → `migrator` (Flyway, einmalig pro Deploy) → `app`.
- **Image-Tags** via GitHub Actions (`.github/workflows/docker-publish.yml`):
  - Commit auf `main` **mit** `[deploy]` in der Message → `:edge`, `:sha-<short>`
  - Git-Tag `v1.2.3` → `:1.2.3`, `:1.2`, `:latest`
  - **`:latest` entsteht nur über Git-Tags**, nie über main-Merges.
- **Trigger**: Der Image-Bau+Push läuft *nur*, wenn die Head-Commit-Message
  den Marker `[deploy]` enthält. Ohne ihn läuft nur `ci.yml` (Typecheck+Build).
- **Migration**: Flyway-Container liest `db/migration/V*__*.sql` (Bind-Mount
  aus dem Repo) und migriert vor jedem App-Start. Die App selbst migriert
  *nicht* — sie geht davon aus, dass das Schema aktuell ist.
- **Watchtower**: Wenn dein Watchtower das App-Image updated, muss es auch
  den Migrator mit demselben `${APP_TAG}` anstoßen (sonst migriert dieser
  mit veralteten SQL-Files). Compose setzt beide via `APP_TAG` synchron.
- **Volumes**: `koch-db` (MariaDB-Daten) und `koch-images` (App-Bilder).
  `/data` im App-Container enthält nur noch Bilder — die DB ist in MariaDB.
- **Reverse Proxy** (Nginx/Caddy) vor `127.0.0.1:3000` für TLS Terminierung.
