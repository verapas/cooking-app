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
- 🔐 **Login**: Session-basierter Admin-Zugang, Bilder/Rezepte geschützt
- 🖼️ **Bild-Upload**: pro Rezept ein Bild (JPG/PNG/WebP/GIF, bis 20 MB)

## Stack

- **SvelteKit 2** + **Svelte 5** (Runes) + TypeScript
- **MariaDB** via `mysql2` (async, Connection-Pool)
- **Flyway** für Schema-Migrationen (separater Container beim Deploy)
- `@sveltejs/adapter-node` (Produktions-Build → `node build`)
- `@vite-pwa/sveltekit` (PWA mit Service Worker)
- `bcryptjs` (Passwort-Hashing), `sweetalert2` (Bestätigungsdialoge)
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
pnpm docker:reset  # stoppt Container + löscht DB-Volumes (frischer Seed)
```

Nach `pnpm docker:dev` läuft die App auf **http://localhost:3000**.
Login: `admin` / `devpassword` (fest in `compose.dev.yaml`).

#### Architektur der Dev-Compose

Drei Services, die nacheinander starten:

```
mariadb  ──(healthy)──▶  migrator  ──(exit 0)──▶  app
   │                        │                       │
   │                        │                       ├─ Port 3000 (Loopback)
   │                        │                       └─ Volume /data/images
   │                        │
   │                        ├─ Flyway-Container, läuft einmalig
   │                        ├─ liest db/migration/V*__*.sql
   │                        └─ beendet sich nach erfolgreicher Migration
   │
   └─ Volume koch-db-dev (persistente DB-Daten)
```

- **`mariadb`**: Datenbank. Daten liegen im Named Volume `koch-db-dev`
  und überleben `pnpm docker:down`. Nur `pnpm docker:reset` löscht sie.
- **`migrator`**: Flyway-Container. Startet bei jedem `up`, prüft, ob neue
  Migrationen anstehen, wendet sie an und beendet sich (Exit 0). Bei
  unverändertem Schema: „up to date, no migration necessary".
- **`app`**: Die eigentliche Koch-App. Startet erst, wenn der Migrator
  erfolgreich durchlief (`depends_on: service_completed_successfully`).

#### Warum zwei Compose-Dateien?

| Datei | Zweck | Image-Quelle |
|---|---|---|
| `compose.dev.yaml` (Root) | **Lokal**: Image wird aus dem Dockerfile gebaut (`build: .`) | lokal |
| `deploy/compose.example.yaml` | **Produktion**: Image wird aus GHCR gezogen (`image: ghcr.io/OWNER/REPO`) | Registry |

In der Produktion baut der Server **nicht** selbst — er zieht das fertige
Image aus der Registry. Nur lokal (Dev) bauen wir direkt aus dem Source.

## Produktion / Deployment

### Der komplette Deploy-Fluss

```
Du: git commit -m "fix: … [deploy]" && git push origin main
        │
        ▼
GitHub Actions (docker-publish.yml)
   ├─ baut das Image aus dem Dockerfile
   ├─ taggt es als ghcr.io/<owner>/<repo>:edge
   └─ pusht es nach GHCR (GitHub Container Registry)
        │
        ▼
Dein Server (Proxmox):
   └─ Watchtower erkennt neues Image → docker compose pull && up -d
      (mariadb + migrator + app aktualisieren sich automatisch)
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

Wenn dein Watchtower das App-Image updatet, muss er auch den **Migrator**
mit demselben Tag neu starten — sonst migriert dieser mit veralteten
SQL-Files. Die Compose setzt beide Services über `${APP_TAG}` synchron.

## API

Die API ist über SvelteKit-Endpunkte (`src/routes/api/`) realisiert.
Schreibzugriffe (POST/PUT/DELETE) sind **session-geschützt** — der Client
muss eingeloggt sein (Cookie). GET-Endpunkte sind ebenfalls hinter dem
Login (außer `/api/auth/*`).

### Authentifizierung

| Methode | Route | Beschreibung |
|---|---|---|
| POST | `/api/auth/login` | Login mit `username`/`password` → setzt Session-Cookie |
| POST | `/api/auth/logout` | Logout (löscht Session) |
| GET | `/api/auth/verify` | Prüft, ob die Session gültig ist |

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

## Datenmodell

`categories` → `recipes` → `steps` + `ingredients` (Zutaten sind optional
einem Schritt zugeordnet). Details zum Schema: `db/migration/V1__init_schema.sql`.
Schema-Änderungen immer als neue Flyway-Migration (`V2__…`, `V3__…`), nie
manuell — Flyway checksummt die Dateien.

## Konfiguration (Env-Variablen)

| Variable | Default | Beschreibung |
|---|---|---|
| `ADMIN_USERNAME` | `admin` | Login-Name für den Admin |
| `ADMIN_PASSWORD` | – | Passwort (muss gesetzt sein, sonst Schreib-Sperre) |
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
