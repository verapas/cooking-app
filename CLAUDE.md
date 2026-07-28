# Koch-App

Mobile-first Web-App für Kochrezepte. Gebaut mit **SvelteKit + SQLite**. Läuft als
Node-Prozess (`@sveltejs/adapter-node`) — gedacht für Self-Hosting (z. B. Proxmox).
UI komplett auf Deutsch.

## Tech-Stack

- **SvelteKit 2** + **Svelte 5** (Runes: `$state`, `$derived`, `$props`, `$bindable`) + TypeScript
- **SQLite** via `better-sqlite3` (nur server-seitig, synchron)
- **adapter-node** (Produktions-Build → `node build`)
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
src/lib/components/    # UI-Komponenten (BottomNav gibt es NICHT mehr)
src/lib/portion.ts     # Portionen-Skalierung + Mengen-/Dauer-Formatierung
src/lib/sound.ts       # Web-Audio-Bleep + Vibration (für den Stepper-Timer)
src/lib/wakeLock.ts    # Screen Wake Lock (Bildschirm beim Kochen anlassen)
src/lib/auth.svelte.ts # Client-Auth-State (Token im localStorage)
src/lib/nav.svelte.ts  # Drawer-Open-State (universal reactivity)
src/routes/            # SvelteKit-Routing (+layout, +page, api/, images/)
src/hooks.server.ts    # Seed beim Start + Token-Auth für Schreib-APIs
```

## Wichtige Konventionen

- **Svelte 5 Runes**, keine alten Stores/`$:`. State aus einem Prop initialisieren →
  `untrack()` nutzen, sonst `state_referenced_locally`-Warnung:
  `let servings = $state(untrack(() => data.recipe.base_servings));`
- **DB-Zugriff immer server-only** (`src/lib/server/*`, `+page.server.ts`, `+server.ts`).
  Niemals `$lib/server/*` in Client-Komponenten importieren.
- **Schreib-APIs sind token-geschützt** (`hooks.server.ts` prüft
  `Authorization: Bearer $COOKING_API_TOKEN` für POST/PUT/DELETE unter `/api/*`).
  GET ist offen. Derselbe Token ist auch das **Admin-Login-Passwort** (`/login`).

## Datenmodell

`categories` → `recipes` → `steps` + `ingredients`.
- `ingredients.quantity` muss **numerisch** sein (für Portionen-Skalierung).
  `0`/`null` = „nach Geschmack" → Menge wird ausgeblendet.
- `ingredients.step_order` ordnet eine Zutat einem Schritt zu (1-basiert nach `order`).
- `steps.duration_sec` aktiviert den Timer im Stepper.
- `recipes.image_url` wird beim Bild-Upload gesetzt (`/images/recipe-<id>-<ts>.<ext>`).

## Bild-Upload & Login

- Login: `/login` (oder Drawer → „Einloggen"). Token verifizieren via `GET /api/auth/verify`,
  dann im `localStorage` gespeichert.
- Upload: `POST /api/recipes/[id]/image` (multipart, Feld `image`, token-geschützt).
  Speichert nach `data/images/`, setzt `image_url`, löscht das alte Bild.
  Validierung: JPG/PNG/WebP/GIF, max. 5 MB.
- Bilder ausliefern: `GET /images/[file]`.

## Seed ändern / Kategorien & Rezepte anpassen

`src/lib/server/seed.ts` läuft **nur, wenn die DB noch keine Rezepte enthält**
(`seedIfEmpty`). Um neue Demo-Daten zu erzwingen:
```bash
rm -f data/cooking.db data/cooking.db-shm data/cooking.db-wal   # beim nächsten Start neu geseedet
```

## Gotchas (Stolpersteine)

- **better-sqlite3** ist ein natives Modul. pnpm muss sein Build erlauben →
  steht in `pnpm-workspace.yaml` (`allowBuilds: better-sqlite3: true`).
  v13 liefert prebuilt Binaries mit (kein node-gyp nötig).
- **`curl` aus Git-Bash vermasselt multipart-Datei-Uploads** (HTTP 000). Zum Testen
  der Upload-API lieber Node `fetch`+`FormData` nutzen — der Browser macht es eh so.
- **Port 5173 hängt manchmal fest** (überlebende Vite-Kindprozesse). Vor `pnpm dev`
  ggf. aufräumen. Hinweis: `netstat` zeigt unter Windows-Deutsch **„ABHÖREN"**, nicht
  „LISTENING" — beim Filtern beachten.
- **Env-Variablen** (`.env`, nicht committen):
  `COOKING_API_TOKEN` (auch Admin-Login), `DATABASE_PATH` (default `./data/cooking.db`),
  `IMAGES_DIR` (default `./data/images`). `$env/dynamic/private` liest sie zur Runtime.
- **`Date.now()` / `Math.random()`** sind nur in Workflow-Skripten gesperrt — im
  normalen App-Code (server- wie client-seitig) frei nutzbar.

## Deployment (Proxmox)

```bash
pnpm build
COOKING_API_TOKEN=<token> DATABASE_PATH=/var/lib/cooking/db.sqlite \
  IMAGES_DIR=/var/lib/cooking/images PORT=3000 ORIGIN=https://app.example.com node build
```
Hinter einem Reverse Proxy (Nginx/Caddy) betreiben. `data/` (DB + Bilder) persistent
mappen (Volume), damit Rezepte/Bilder einen Neustart überleben.
