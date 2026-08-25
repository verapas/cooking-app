# Koch-App 🍳

Mobile-first Web-App für Kochrezepte, gebaut mit **SvelteKit + MariaDB**.
Läuft als Docker-Container (`adapter-node`) – gedacht für Self-Hosting
(z. B. auf einem Proxmox-Server hinter einem Reverse Proxy). UI komplett
auf Deutsch. PWA-fähig mit Offline-Unterstützung.

## Features

- 📱 Mobile-first, Dark-Theme (Koch-Modus – blendet beim Kochen nicht)
- 🗂️ Kategorien-Navigation (Suppen, Pasta, Desserts, …)
- 📖 Rezept-Detail in zwei Ansichten:
  - **Klassisch**: komplette Zutatenliste + nummerierte Schritte
  - **Schritt für Schritt**: iterierbarer Stepper mit **aktivem Timer**
    (Signalton, Vibration, Bildschirm-Wachhaltung)
- 🔢 **Portionen-Umschalter**: alle Mengen skalieren live mit
- 🔄 **Rezept-Versionen**: Varianten eines Rezepts (z. B. „Schnelle Version")
- ⭐ **Favoriten**: Rezepte markieren und gesammelt abrufen
- 🖼️ **Bild-Upload**: pro Rezept ein Bild (JPG/PNG/WebP/GIF, bis 20 MB)
- ✨ **KI-Assistent**: Rezepte per Chat mit einer KI planen und anlegen
  (beliebiger OpenAI-kompatibler Anbieter, z. B. **z.ai**, OpenRouter,
  OpenAI oder lokales LM Studio) – inkl. Verbessern/Neu-Versionieren
  bestehender Rezepte. Streaming-Antworten, Anbieter frei konfigurierbar.

## Stack

- **SvelteKit 2** + **Svelte 5** (Runes) + TypeScript
- **MariaDB** via `mysql2` (async, Connection-Pool)
- **Flyway** für Schema-Migrationen (separater Container beim Deploy)
- `@sveltejs/adapter-node` (Produktions-Build → `node build`)
- `@vite-pwa/sveltekit` (PWA mit Service Worker)
- `sweetalert2` (Bestätigungsdialoge)
- `openai` (OpenAI-kompatibles SDK für den KI-Assistenten, provider-unabhängig)
- Package-Manager: **pnpm**

## Entwicklung

```bash
pnpm install
pnpm dev          # Dev-Server auf http://localhost:5173
pnpm check        # Typecheck
pnpm build        # Produktions-Build nach build/
```

> ⚠️ **`pnpm dev` braucht eine erreichbare MariaDB-Instanz.** Entweder
> läuft eine externe MariaDB (dann Env-Variablen `DB_HOST` etc. in `.env`
> setzen), oder du startest den vollen Docker-Stack (siehe unten) und
> entwickelst gegen die dockerisierte DB.

### Volles Stack lokal (mit Docker)

Für den kompletten Test (App + MariaDB + Flyway-Migration) steht eine
eigene Dev-Compose bereit, die das Image lokal baut:

```bash
pnpm docker:dev    # baut Image + startet mariadb, migrator, app
pnpm docker:logs   # Live-Logs aller Services (Strg+C beendet nur die Anzeige)
pnpm docker:down   # stoppt Container, Volumes bleiben erhalten
pnpm docker:reset  # stoppt Container + löscht DB-Volumes (frischer Start)
```

Nach `pnpm docker:dev` läuft die App auf **http://localhost:3000**.

Der Stack besteht aus drei Services, die nacheinander starten:
`mariadb` (DB) → `migrator` (Flyway, einmalig pro Start) → `app`.
Details stehen direkt in `compose.dev.yaml`.

> Hinweis: Beim ersten Start ist die Datenbank **leer** bis auf die Standard-
> Kategorien (Suppen, Pasta, …), die beim ersten Request automatisch durch den
> idempotenten Hook in `src/hooks.server.ts` angelegt werden. Demo-Rezepte und
> ein App-Login gibt es nicht — Rezepte legst du selbst an, z. B. über den
> KI-Assistenten
> (Drawer → „Neues Rezept (KI)").

### Nur Vite-Dev (mit Hot-Reload)

Wenn du an der App entwickelst und schnelles Hot-Reload brauchst:

```bash
pnpm docker:dev        # Stack starten (brauchst du nur für die DB)
docker stop koch-app-dev   # App-Container stopfen (Port 3000 frei)
pnpm dev                   # Vite-Dev auf :5173 gegen die dockerisierte DB
```

## Produktion / Deployment

### Der komplette Deploy-Fluss

```
Du: git commit -m "fix: … [deploy]" && git push origin main
        │
        ▼
GitHub Actions (docker-publish.yml)
   ├─ baut ZWEI Images aus dem Dockerfile:
   │    ghcr.io/<owner>/<repo>:edge           → App (adapter-node)
   │    ghcr.io/<owner>/<repo>-migrator:edge  → Flyway + db/migration
   ├─ taggt beide identisch (:edge, :sha-<short>)
   └─ pusht sie nach GHCR (GitHub Container Registry)
        │
        ▼
Dein Server (Proxmox):
   └─ Watchtower erkennt neue Images → docker compose pull && up -d
      (migrator läuft einmal mit den neuen SQL-Files, dann startet
      die App gegen das aktuelle Schema — alles automatisch)
```

### Der `[deploy]`-Trigger

Das Image wird **nur gebaut und gepusht**, wenn die Commit-Message den
Marker `[deploy]` enthält. Ohne ihn läuft nur der CI-Check (Typecheck +
Build), aber kein Image-Push. So kannst du beliebig oft pushen, ohne
jedes Mal ein neues Image zu erzeugen.

```bash
git commit -m "feat: neue Suche [deploy]"   # → Image wird gebaut
git commit -m "docs: readme typo"           # → nur CI-Check, kein Image
```

### Image-Tags

| Trigger | Tags |
|---|---|
| Commit auf `main` mit `[deploy]` | `:edge`, `:sha-<short>` |
| Git-Tag `v1.2.3` | `:1.2.3`, `:1.2`, `:latest` |

`:latest` entsteht **nur über Git-Tags**, nie über main-Merges — damit
ein Merge nicht automatisch dein Prod-Deployment anfasst.

### Auf dem Server einrichten

1. `deploy/compose.example.yaml` nach `deploy/compose.yaml` kopieren.
2. `deploy/.env.example` nach `deploy/.env` kopieren und Werte setzen
   (Passwörter, `OWNER/REPO` im Compose ersetzen, `ORIGIN`).
3. `docker login ghcr.io` mit einem GitHub-PAT (read:packages).
4. `docker compose -f deploy/compose.yaml up -d`.
5. Reverse Proxy (Nginx/Caddy) vor `127.0.0.1:3000` für TLS schalten.

### Watchtower-Hinweis

Die Migrationen stecken **im Migrator-Image** (`…-migrator`, gleicher Tag
wie die App) — nicht mehr in einem Bind-Mount auf dem Server. App und
Migrator müssen daher mit demselben `${APP_TAG}` gezogen werden; die
Compose setzt beide Services über die Variable synchron. Ablauf beim
Update: Pull → Migrator läuft einmal mit den neuen SQL-Files → App startet.

## API

Die API ist über SvelteKit-Endpunkte (`src/routes/api/`) realisiert.
**Wichtig:** Es gibt kein App-Level-Login — alle Endpunkte sind ungeschützt
auf App-Ebene. Der Zugriffsschutz liegt vollständig beim Reverse Proxy /
Netzwerk (die App sollte nie direkt aus dem Internet erreichbar sein).

### Kategorien & Rezepte

| Methode | Route | Beschreibung |
|---|---|---|
| GET | `/api/recipes?category_id=&q=` | Rezept-Liste (mit Filter/Suche) |
| GET | `/api/recipes/:id` | Rezept-Detail (mit Zutaten + Schritten) |
| POST | `/api/recipes` | Rezept anlegen |
| PUT | `/api/recipes/:id` | Rezept ändern |
| DELETE | `/api/recipes/:id` | Rezept löschen |
| GET | `/api/recipes/:id/versions` | Alle Versionen eines Rezepts |
| POST | `/api/recipes/:id/favorite` | Favorit-Status umschalten |
| POST | `/api/recipes/:id/image` | Bild hochladen (multipart, bis 20 MB) |
| GET | `/api/categories` | Alle Kategorien |
| POST | `/api/categories` | Kategorie anlegen |
| PUT | `/api/categories/:id` | Kategorie ändern |
| DELETE | `/api/categories/:id` | Kategorie löschen |

### KI-Assistent (provider-unabhängig)

| Methode | Route | Beschreibung |
|---|---|---|
| POST | `/api/chat` | Streaming-Chat (SSE); Body `{ messages, mode, recipeId? }` |
| POST | `/api/chat/finalize` | Liefert ein validiertes `RecipeInput`-JSON aus dem Verlauf |
| GET | `/api/settings` | KI-Status (Key maskiert, Modell, Base-URL) |
| PUT | `/api/settings` | Konfiguration setzen (Body `{ ai_api_key?, ai_model?, ai_base_url? }`) |

### Beispiel: Rezept anlegen

Zuerst einloggen (Cookie speichern), dann:

```bash
curl -X POST http://localhost:3000/api/recipes \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tomaten-Mozzarella-Pasta",
    "category_slug": "pasta",
    "base_servings": 2,
    "steps": [
      {"order": 1, "instruction": "Pasta kochen.", "duration_sec": 600},
      {"order": 2, "instruction": "Tomaten anbraten, Mozzarella unterheben."}
    ],
    "ingredients": [
      {"name": "Spaghetti",    "quantity": 200, "unit": "g", "step_order": 1},
      {"name": "Kirschtomaten","quantity": 250, "unit": "g", "step_order": 2},
      {"name": "Mozzarella",   "quantity": 125, "unit": "g", "step_order": 2}
    ]
  }'
```

- `quantity` **muss numerisch** sein (sonst kann nicht skaliert werden).
  `0`/`null` bedeutet „nach Geschmack" – die Menge wird dann ausgeblendet.
- `step_order` ordnet eine Zutat einem Schritt zu (1-basiert, nach `order`).
  Fehlt der Wert, erscheint die Zutat in der globalen Zutatenliste.
- `duration_sec` aktiviert den Timer für diesen Schritt.

## KI-Assistent (Rezepte per Chat erstellen/verbessern)

Der KI-Assistent erlaubt es, Rezepte in einem Chat zu planen und sie
direkt in der App anzulegen. Es funktioniert **jeder OpenAI-kompatible
Anbieter** (z. B. z.ai direkt, OpenRouter, OpenAI oder ein lokales
LM Studio). Antworten werden gestreamt.

**Einrichtung (einmalig):**
1. Beim Anbieter deiner Wahl einen API-Key erzeugen (z. B. bei z.ai).
2. In der App unter **Einstellungen** (Drawer → „Einstellungen") einen
   Anbieter per Vorlage wählen oder Base-URL, Modell und Key manuell
   eintragen. Alles wird **serverseitig** in der DB gespeichert
   (`settings`-Tabelle) – der Key verlässt nie den Server und wird im
   Client nur maskiert angezeigt.

**Zwei Wege:**
- **Neues Rezept** (Drawer → „Neues Rezept (KI)"): Chat starten, Rezept
  planen, „Rezept aus Chat erstellen" → Vorschau prüfen → anlegen.
- **Bestehendes verbessern** (✨-Button auf der Rezept-Detailseite):
  Original **überschreiben** *oder* als **neue Version** speichern.

Der Chat-Verlauf wird bewusst **nicht** gespeichert – nur das fertige
Rezept am Ende.

## Datenmodell

`categories` → `recipes` → `steps` + `ingredients` (Zutaten sind optional
einem Schritt zugeordnet). Details zum Schema: `db/migration/V1__init_schema.sql`.
Zusätzlich gibt es seit `V2__settings.sql` die Tabelle `settings` (`key`,
`value`) für die KI-Konfiguration (API-Key, Modell, Base-URL — seit `V3`
generisch für beliebige Anbieter).
Schema-Änderungen immer als neue Flyway-Migration (`V2__…`, `V3__…`), nie
manuell — Flyway checksummt die Dateien.

## Konfiguration (Env-Variablen)

| Variable | Default | Beschreibung |
|---|---|---|
| `ORIGIN` | – | Öffentliche URL (für Cookie/CORS) |
| `DB_HOST` | `localhost` | MariaDB-Host |
| `DB_PORT` | `3306` | MariaDB-Port |
| `DB_NAME` | `cooking` | Datenbank-Name |
| `DB_USER` | `cooking` | DB-User |
| `DB_PASSWORD` | – | DB-Passwort |
| `IMAGES_DIR` | `/data/images` | Ablageort für hochgeladene Bilder |

Lokal in `.env` ablegen (wird nicht committet). `$env/dynamic/private`
liest sie zur Runtime.

## Lizenz

Privatprojekt.
