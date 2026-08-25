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
- **sweetalert2** (Bestätigungsdialoge)
- Package-Manager: **pnpm**

## Befehle

```bash
pnpm install     # einmalig (canvas muss gebaut werden → s. Gotchas)
pnpm dev         # Dev-Server auf http://localhost:5173
pnpm build       # Produktions-Build nach build/ → dann `node build`
pnpm check       # Typecheck (svelte-kit sync && svelte-check)

# Docker (lokaler Fullstack-Test: mariadb + migrator + app):
pnpm docker:dev    # Image bauen + Stack starten (detached). App auf :3000
pnpm docker:logs   # Live-Logs aller Services (Strg+C beendet nur die Anzeige)
pnpm docker:down   # Stack stoppen, Volumes bleiben erhalten (Daten überleben)
pnpm docker:reset  # Stack stopfen + DB-Volumes löschen → nächster Start resettet
```

**`pnpm dev` braucht eine erreichbare MariaDB** unter `127.0.0.1:3306`.
Dafür einmal `pnpm docker:dev` starten (Port ist in `compose.dev.yaml`
freigegeben), dann den App-Container stoppen (`docker stop koch-app-dev`)
und `pnpm dev` laufen lassen.

## Architektur

```
src/lib/server/        # NUR server-seitig (nie vom Client importieren!)
  db.ts                # mysql2-Pool (Singleton) + Date-Helper (alle async)
  queries.ts           # alle Query-/Mutations-Funktionen (alle async)
  settings.ts          # Key/Value-Settings (settings-Tabelle) + KI-Komfort-Helper
  ai.ts                # KI-Integration (provider-unabhängig): Streaming + Finalize
src/lib/components/    # UI-Komponenten
  PWAInstall.svelte    # PWA-Install-Button
  OfflineIndicator.svelte # Online/Offline-Statusanzeige
  ChatPanel.svelte     # KI-Chat (Streaming, Finalize-Vorschau, Speichern)
src/lib/portion.ts     # Portionen-Skalierung + Mengen-/Dauer-Formatierung
src/lib/sound.ts       # Web-Audio-Bleep + Vibration (für den Stepper-Timer)
src/lib/wakeLock.ts    # Screen Wake Lock (Bildschirm beim Kochen anlassen)
src/lib/nav.svelte.ts  # Drawer-Open-State (universal reactivity)
src/lib/types.ts       # TypeScript-Typen für Rezept-Daten
src/routes/            # SvelteKit-Routing (+layout, +page, api/, images/, offline/)
  +page.svelte         # Hauptseite (Rezeptliste)
  +page.server.ts      # Load-Funktionen (await Query-Calls)
  /favorites/          # Favoriten-Seite
  /offline/            # Offline-Fallback-Seite
  /chat/               # KI-Chat (?recipe=<id> = improve-Modus)
  /settings/           # KI-Einstellungen (API-Key, Modell, Base-URL)
  /recipe/[id]/        # Rezept-Detail (KI-Button → /chat?recipe=<id>)
  /recipe/[id]/edit/   # Rezept-Bearbeitung
  /api/                # REST-API-Endpunkte
  /images/             # Bild-Auslieferung
src/hooks.server.ts    # Kategorie-Seeder beim ersten Request + Pass-Through
                       # (kein App-Login — Schutz via Reverse Proxy)
db/migration/          # Flyway-SQL-Scripts (V1__init_schema.sql etc.) — landen
                       # im Migrator-Image (Dockerfile-Target "migrator"), nicht
                       # per Bind-Mount auf dem Server; die App selbst migriert nie
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
- **Kein App-Login mehr**: Die App besitzt keine eigene Authentifizierung. Der
  Zugriffsschutz liegt vollständig auf Infrastrukturebene (Reverse Proxy / VPN /
  internes Netz) — der Container sollte nie direkt aus dem Internet erreichbar sein.
  `hooks.server.ts` ist ein reiner Pass-Through; alle Schreib-APIs sind ohne
  App-Level-Schutz. Das war eine bewusste Entscheidung.
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
- **Auth-Tabellen entfernt** (V4): `users`/`sessions` wurden mit `V4__drop_auth.sql`
  gedroppt — die App hat kein eigenes Login mehr (Schutz via Reverse Proxy).
- **Settings** (V2-Tabelle + V3-Werte): `settings` (`key`, `value`, `updated_at`) — Key/Value
  für App-Konfiguration. Aktuell: `AI_API_KEY` (geheim, nie an den Client), `AI_MODEL`
  (z. B. `glm-5.2`) und `AI_BASE_URL` (z. B. `https://api.z.ai/api/paas/v4`).
  Gelesen/geschrieben via `src/lib/server/settings.ts`.

## Bild-Upload

- Upload: `POST /api/recipes/[id]/image` (multipart, Feld `image`).
  Speichert nach `$IMAGES_DIR` (default `/data/images` im Container bzw.
  `./data/images` lokal), setzt `image_url`, löscht das alte Bild.
  Validierung: JPG/PNG/WebP/GIF, max. 20 MB.
- Bilder ausliefern: `GET /images/[file]`.

## KI-Chat (provider-unabhängig)

KI-Assistent zum **Planen neuer Rezepte** (Nav „Neues Rezept (KI)" → `/chat`) und
zum **Verbessern bestehender Rezepte** (Button auf der Detailseite → `/chat?recipe=<id>`).
Die Anbindung ist **provider-unabhängig**: jeder OpenAI-kompatible Anbieter funktioniert
(z. B. **z.ai direkt**, OpenRouter, OpenAI, lokales LM Studio). Antworten werden
**gestreamt** (SSE).

- **Konfiguration** (drei Werte, in der App unter `/settings`, in der `settings`-Tabelle):
  - `AI_API_KEY` — der Provider-API-Key (geheim, nie an den Client; `GET /api/settings`
    liefert nur `has_key` + maskierten Hint).
  - `AI_MODEL` — Modell-String des Anbieters, z. B. `glm-5.2` (Default) oder `glm-4.6`.
  - `AI_BASE_URL` — OpenAI-kompatible Base-URL, Default `https://api.z.ai/api/paas/v4`.
  Die Settings-Seite bietet Vorlagen (Presets) für gängige Anbieter.
- **Zweistufige Interaktion**: (1) Chat-Phase streamt normalen Text (`POST /api/chat`).
  (2) „Rezept aus Chat erstellen" ruft `POST /api/chat/finalize` auf → ein nicht-streamender
  Aufruf mit `response_format: json_object` liefert ein validiertes `RecipeInput`.
- **Speichern über die bestehenden REST-Endpunkte** (kein neues Speicher-Handling):
  - Neues Rezept → `POST /api/recipes`
  - Original überschreiben → `PUT /api/recipes/[id]`
  - Neue Version → `POST /api/recipes` mit `parent_recipe_id` + `version_name`
  `validateRecipeInput` in `ai.ts` prüft/normalisiert das KI-JSON vor dem Speichern.
- **Verlauf nicht persistiert**: Der Chat-Verlauf lebt nur im Client-State (`ChatPanel.svelte`).
  Nur das fertige Rezept wird gespeichert.
- **Abhängigkeit**: `openai` (npm). Da jeder Provider OpenAI-kompatibel ist, reicht in
  `src/lib/server/ai.ts` ein Austausch von `baseURL` (aus den Settings).

## Ersteinrichtung / leere Datenbank

Beim ersten Request legt `src/hooks.server.ts` automatisch die Standard-
**Kategorien** an (Suppen, Salate, Pasta, …) — idempotent via
`seedCategoriesIfEmpty()` aus `src/lib/server/seed.ts`, läuft nur wenn die
Tabelle noch leer ist. Es gibt **keinen** Auth-Seeder und **keine** Demo-Rezepte
mehr. Rezepte legst du selbst an:
- Kategorien ergänzen/ändern: Drawer → „Einstellungen" (bzw. via `POST /api/categories`)
- Rezepte: Drawer → „Neues Rezept (KI)" (per Chat) oder manuell
```bash
pnpm docker:reset   # stoppt den Stack und löscht die MariaDB-Volumes
pnpm docker:dev     # beim nächsten Start ist die DB leer (V1–V4 migrieren),
                    # Standard-Kategorien werden beim ersten Request geseedet
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
  `DB_HOST` (default `localhost`), `DB_PORT` (default `3306`),
  `DB_NAME` (default `cooking`), `DB_USER` (default `cooking`), `DB_PASSWORD`,
  `IMAGES_DIR` (default `./data/images`). `$env/dynamic/private` liest sie zur Runtime.
- **`Date.now()` / `Math.random()`** sind nur in Workflow-Skripten gesperrt — im
  normalen App-Code (server- wie client-seitig) frei nutzbar.

## API-Endpunkte

> Hinweis: Es gibt kein App-Level-Login mehr. Alle Endpunkte sind ungeschützt auf
> App-Ebene — der Schutz liegt beim Reverse Proxy (s.o.).

### Kategorien
- `GET /api/categories` - Alle Kategorien
- `POST /api/categories` - Kategorie erstellen
- `PUT /api/categories/[id]` - Kategorie bearbeiten
- `DELETE /api/categories/[id]` - Kategorie löschen

### Rezepte
- `GET /api/recipes[?category_id=...&q=...]` - Rezepte suchen/listen
- `POST /api/recipes` - Rezept erstellen
- `GET /api/recipes/[id]` - Rezept-Detail
- `PUT /api/recipes/[id]` - Rezept bearbeiten
- `DELETE /api/recipes/[id]` - Rezept löschen
- `GET /api/recipes/[id]/versions` - Alle Versionen eines Rezepts
- `POST /api/recipes/[id]/favorite` - Favorit-Status umschalten
- `POST /api/recipes/[id]/image` - Bild hochladen (multipart)

### Favoriten
- `GET /api/favorites` - Alle favorisierten Rezepte

### Bilder
- `GET /images/[file]` - Bild ausliefern

### KI-Chat (provider-unabhängig)
- `POST /api/chat` - Streaming-Chat (SSE, `data: {"delta"}`/`data: [DONE]`); Body `{ messages, mode, recipeId? }`
- `POST /api/chat/finalize` - Liefert validiertes `RecipeInput`-JSON aus dem Chat-Verlauf
- `GET /api/settings` - KI-Status (Key **maskiert**, nie im Klartext; `has_key`, `ai_model`, `ai_base_url`)
- `PUT /api/settings` - Konfiguration setzen; Body `{ ai_api_key?, ai_model?, ai_base_url? }`

## Infrastruktur

Die App läuft hinter **Traefik** (TLS/Reverse Proxy) → **Nginx Alpine** (Forward Proxy)
→ **Koch-App** (Node, Port 3000). Authentifizierung über **Keycloak** via
`traefik-forward-auth` auf Traefik-Ebene. **PWA-Assets** (`/manifest.webmanifest`,
`/sw.js`, `/workbox-*.js`, Icons) sind über einen separaten Traefik-Router
**ohne Auth** erreichbar — sonst kann Chrome die PWA nicht installieren.
Volle Doku: [`INFRA.md`](./INFRA.md).

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
- **Zwei Images** pro Release (gleich getaggt, CI pusht beide):
  `ghcr.io/<owner>/<repo>` (App) und `ghcr.io/<owner>/<repo>-migrator`
  (Flyway + `db/migration/` der Image-Revision).
- **Migration**: Die SQL-Files sind **im Migrator-Image enthalten** (Dockerfile-
  Target `migrator`) — kein Bind-Mount vom Host mehr. Damit sind App-Revision
  und Schema-Version immer synchron (Watchtower aktualisiert Images, keine
  Host-Dateien). Die App selbst migriert *nicht* — sie geht davon aus, dass
  das Schema aktuell ist.
- **Image-Tags** via GitHub Actions (`.github/workflows/docker-publish.yml`):
  - Commit auf `main` **mit** `[deploy]` in der Message → `:edge`, `:sha-<short>`
  - Git-Tag `v1.2.3` → `:1.2.3`, `:1.2`, `:latest`
  - **`:latest` entsteht nur über Git-Tags**, nie über main-Merges.
- **Trigger**: Der Image-Bau+Push läuft *nur*, wenn die Head-Commit-Message
  den Marker `[deploy]` enthält. Ohne ihn läuft nur `ci.yml` (Typecheck+Build).
- **Watchtower**: App und Migrator müssen mit demselben `${APP_TAG}` gezogen
  werden — Compose setzt beide Services über die Variable synchron. Update-
  Ablauf: Pull → migrator läuft einmal mit den neuen SQL-Files → App startet.
- **Volumes**: `koch-db` (MariaDB-Daten) und `koch-images` (App-Bilder).
  `/data` im App-Container enthält nur noch Bilder — die DB ist in MariaDB.
- **Reverse Proxy** (Nginx/Caddy) vor `127.0.0.1:3000` für TLS Terminierung.
