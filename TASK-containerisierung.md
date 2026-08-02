# Task: Containerisierung + GitHub-Actions-Pipeline

Du arbeitest im Repo der Koch-App (SvelteKit 2 + Svelte 5 + SQLite via
better-sqlite3, adapter-node, pnpm). Lies zuerst `CLAUDE.md` — dort stehen
Architektur, Env-Variablen und bekannte Stolpersteine.

Ziel: Die App läuft als Docker-Container, ein Image wird per GitHub Actions
gebaut und nach GHCR gepusht. Deployment-Ziel ist ein Proxmox-Host hinter einem
Reverse Proxy.

Arbeite die Phasen der Reihe nach ab. **Committe nichts automatisch** — am Ende
zeigst du mir eine Zusammenfassung, ich committe selbst.

---

## Phase 0 — Bestandsaufnahme (erst lesen, dann schreiben)

Prüfe und berichte mir kurz:

1. `package.json`: Welche Node-Version steht in `engines`? Welcher
   `packageManager`-Eintrag (pnpm-Version)? Welche Scripts existieren wirklich
   (`build`, `check`)? Ist `better-sqlite3` unter `dependencies` (nicht
   `devDependencies`)?
2. `pnpm-workspace.yaml`: Wie heißt das Feld, das den Native-Build von
   better-sqlite3 erlaubt? Bei pnpm 10 muss es `onlyBuiltDependencies:
   ["better-sqlite3"]` heißen. In `CLAUDE.md` ist `allowBuilds` dokumentiert —
   falls das im Repo so drinsteht, ist es **falsch** und der Native-Build wird
   im Container stillschweigend übersprungen. Korrigiere es und sag mir, dass
   du das getan hast.
3. `svelte.config.js`: Ist `adapter-node` konfiguriert? Gibt es dort Optionen,
   die Env-Var-Namen umbenennen (`envPrefix`)?
4. `.gitignore`: Sind `data/` und `.env` ignoriert?
5. Existiert schon ein `Dockerfile`, `compose.yaml` oder `.github/workflows/`?
   Falls ja: **nicht überschreiben**, mir melden und auf meine Antwort warten.
6. Ist `docker` in dieser Umgebung verfügbar (`docker version`)? Davon hängt
   Phase 3 ab.

Benutze für Node-Major und pnpm-Version im Dockerfile die Werte aus dem Repo,
nicht irgendwelche geratenen.

---

## Phase 1 — Dockerfile + .dockerignore

Erstelle im Repo-Root ein Multi-Stage-`Dockerfile` mit diesen harten
Anforderungen:

- **Base-Image `node:<major>-bookworm-slim`, NICHT Alpine.** better-sqlite3
  liefert Prebuilds nur für glibc; auf musl müsste node-gyp + python3 im Image
  kompilieren.
- Gleicher Node-Major in Build- und Runtime-Stage (sonst ABI-Mismatch beim
  nativen Modul).
- pnpm über `corepack enable`, `ENV CI=true`.
- Stage `build`: nur Manifest-Dateien kopieren → `pnpm install
  --frozen-lockfile` → dann Rest kopieren → `pnpm build`. (Reihenfolge wegen
  Layer-Caching.)
- Stage `prod-deps`: separater `pnpm install --prod --frozen-lockfile`.
- Runtime-Stage kopiert `node_modules` aus `prod-deps`, `build/` aus `build`,
  plus `package.json`. Kein Source-Code, kein pnpm im Runtime-Image.
- Nutze BuildKit-Cache-Mounts für den pnpm-Store
  (`--mount=type=cache,id=pnpm,target=/pnpm/store`).
- Diese ENVs im Runtime-Image setzen:
  - `PORT=3000`
  - `DATABASE_PATH=/data/cooking.db`
  - `IMAGES_DIR=/data/images`
  - `BODY_SIZE_LIMIT=25M` — **kritisch**: adapter-node limitiert Bodies sonst
    auf 512 KB, der 20-MB-Bild-Upload aus `POST /api/recipes/[id]/image`
    scheitert mit 413.
- `ORIGIN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` **nicht** ins Image schreiben —
  die kommen zur Laufzeit von außen.
- `/data` und `/data/images` anlegen, `chown node:node`, dann `USER node`.
  `VOLUME ["/data"]`.
- `EXPOSE 3000`, `CMD ["node", "build"]`.
- HEALTHCHECK ohne curl (ist im slim-Image nicht drin): `node -e` mit `fetch`
  gegen einen Pfad, der ohne Session erreichbar ist — `/login` oder
  `/api/categories`. Prüfe im Code (`src/hooks.server.ts`), welcher Pfad
  wirklich ohne Auth 200 liefert, und nimm den.
- Kommentiere die nicht-offensichtlichen Zeilen auf Deutsch.

`.dockerignore` ebenfalls im Root: mindestens `node_modules`, `build`,
`.svelte-kit`, `data`, `.env*`, `.git`, `.github`, `Dockerfile`,
`compose.yaml`, `*.md`.

`data/` im Build-Context wäre besonders ärgerlich — meine lokale DB und alle
Bilder würden ins Image wandern.

---

## Phase 2 — GitHub Actions

Zwei Workflows unter `.github/workflows/`:

**`ci.yml`** — läuft bei `pull_request` und Push auf `main`. Checkout,
`pnpm/action-setup@v4`, `actions/setup-node@v4` mit `cache: pnpm`, dann
`pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`. Baut kein Image.

**`docker-publish.yml`** — läuft bei Push auf `main`, bei Tags `v*.*.*`, und per
`workflow_dispatch`. Tag-Strategie:

| Trigger | Image-Tags |
|---|---|
| Merge auf `main` | `:edge`, `:sha-<short>` |
| Git-Tag `v1.2.3` | `:1.2.3`, `:1.2`, `:latest` |

`:latest` entsteht **nur** durch einen Git-Tag, nie durch einen main-Merge —
damit ein Merge nicht automatisch mein Prod-Deployment anfasst.

Verwende `docker/setup-buildx-action@v3`, `docker/login-action@v3` (Registry
`ghcr.io`, User `${{ github.actor }}`, Passwort `${{ secrets.GITHUB_TOKEN }}`),
`docker/metadata-action@v5` für die Tags, `docker/build-push-action@v6` mit
`cache-from: type=gha` / `cache-to: type=gha,mode=max` und
`platforms: linux/amd64` (arm64 würde per QEMU emuliert und dauert ewig).

Der Job braucht `permissions: { contents: read, packages: write }`, sonst
schlägt der Push fehl.

Füge einen **auskommentierten** Deploy-Job per SSH ans Ende an (Secrets
`SSH_HOST`, `SSH_USER`, `SSH_KEY`; `docker compose pull && up -d`), mit einem
Kommentar, dass er erst aktiviert werden soll, wenn der Build stabil läuft.

---

## Phase 3 — Verifikation

Falls Docker verfügbar ist:

1. `docker build -t koch-app:test .` — muss durchlaufen.
2. Container starten mit gemountetem Volume und gesetzten Env-Vars
   (`ORIGIN=http://localhost:3000`, Admin-Credentials).
3. Prüfe konkret:
   - Startet der Prozess ohne `ERR_DLOPEN_FAILED`? (Das wäre der
     better-sqlite3-Native-Build → zurück zu Phase 0.2.)
   - Antwortet die App auf `http://localhost:3000`?
   - Login gegen `POST /api/auth/login` mit den gesetzten Credentials → 200 und
     Session-Cookie?
   - Wird die DB unter `/data/` angelegt und ist sie nach `docker rm` +
     Neustart mit demselben Volume noch da?
   - Wie groß ist das Image (`docker images`)? Über ~500 MB deutet darauf hin,
     dass Source oder dev-Dependencies mitgekommen sind.
4. Räume Testcontainer und Testvolume danach auf.

Falls Docker **nicht** verfügbar ist: sag mir das klar, überspringe Phase 3
und liste stattdessen die Befehle auf, die ich lokal ausführen soll.

Den Bild-Upload (`BODY_SIZE_LIMIT`) kannst du schlecht automatisiert testen —
weise mich am Ende explizit darauf hin, dass ich das manuell im Browser prüfen
soll.

---

## Phase 4 — Doku

- Erstelle `compose.yaml` **nicht** im Repo-Root, sondern als
  `deploy/compose.example.yaml` mit Platzhalter `ghcr.io/OWNER/REPO:latest`,
  Named Volume `koch-data:/data`, Port-Binding an `127.0.0.1:3000:3000`
  (Reverse Proxy davor), Env-Vars aus `.env`, Log-Rotation. Dazu eine
  `deploy/.env.example`.
- Ergänze `CLAUDE.md` um einen kurzen Abschnitt „Docker & CI" (nicht mehr als
  ~15 Zeilen): Image-Tags, wie ein Release entsteht (`git tag v1.0.0 && git
  push origin v1.0.0`), Deploy-Kommando, und dass `/data` das Volume ist.
- Korrigiere in `CLAUDE.md` bei dieser Gelegenheit den `allowBuilds`-Eintrag,
  falls er falsch ist.

---

## Abschluss

Berichte mir:
- Welche Dateien du angelegt/geändert hast.
- Was in Phase 0 vom Erwarteten abwich.
- Ergebnis der Verifikation.
- Was ich noch manuell machen muss (GHCR-Package auf public stellen oder
  `docker login ghcr.io` mit PAT, `OWNER/REPO` in der compose-Datei ersetzen,
  Bild-Upload testen).

Keine Commits, kein `git push`. Wenn du an einer Stelle raten müsstest —
insbesondere bei Versionen, Pfaden oder Auth-Verhalten — frag mich lieber.

---

## Aktueller Stand

### Phase 0 — Bestandsaufnahme (abgeschlossen ✅)
- ✅ `package.json`: better-sqlite3 war fälschlich in `devDependencies` → nach `dependencies` verschoben
- ✅ `pnpm-workspace.yaml`: `allowBuilds` war falsch für pnpm 11 → korrigiert zu `onlyBuiltDependencies: ["better-sqlite3", "canvas"]`
- ✅ `svelte.config.js`: adapter-node konfiguriert, kein envPrefix
- ✅ `.gitignore`: erweitert mit node_modules, build, .svelte-kit, Dockerfile, compose.yaml, *.md, .github/
- ✅ Keine Dockerfiles existierten vorab

### Phase 1 — Dockerfile + .dockerignore (abgeschlossen ✅)
- ✅ `Dockerfile` erstellt (Multi-Stage, node:22-bookworm-slim, pnpm cache mounts, ENVs, HEALTHCHECK)
- ✅ `.dockerignore` erstellt (ohne node_modules, damit Build-Stage sie kopieren kann)

### Phase 2 — GitHub Actions (abgeschlossen ✅)
- ✅ `ci.yml` erstellt (läuft auf PR und push zu main)
- ✅ `docker-publish.yml` erstellt (läuft auf push zu main/tags und workflow_dispatch)
- ✅ `master` → `main` lokal umbenannt (nicht auf GitHub)

### Phase 3 — Verifikation (gesprungen ⏭️)
- ❌ Docker Desktop installiert, aber nicht im PATH erreichbar
- ⚠️ Phase 3 übersprungen — Verifikation muss in CI/CD-Umgebung laufen

### Phase 4 — Doku (abgeschlossen ✅)
- ✅ `deploy/compose.yaml` erstellt (Placeholder-Image, Named Volume, Port-Forwarding, Env-Vars, Log-Rotation)
- ✅ `deploy/.env.example` erstellt (Platzhalter für Secrets)
- ✅ `CLAUDE.md` erweitert (Docker & CI ~15 Zeilen)

### Noch zu tun (für Dich)
1. GitHub-Registry-Setup: `docker login ghcr.io` + PAT, dann `OWNER/REPO` in `deploy/compose.yaml` ersetzen
2. Workflows committen und pushen (zu main)
3. CI/CD-Verifikation in GitHub Actions laufen lassen:
   - Image bauen
   - Container mit Volume und Env-Vars starten
   - Login gegen `/api/auth/login` testen
   - Persistenz nach Neustart prüfen
   - Imagegröße prüfen (sollte ~500 MB sein, nicht größer)
4. Bild-Upload testen (20 MB Limit im HTTP-Body ist gesetzt, aber manuell im Browser prüfen)

### Korrekturen im Repo
- `better-sqlite3` von `devDependencies` nach `dependencies` verschoben
- `pnpm-workspace.yaml` von `allowBuilds` zu `onlyBuiltDependencies` korrigiert
- `.dockerignore` erstellt ohne `node_modules` (damit Build-Stage sie kopieren kann)
- `pnpm-lock.yaml` aktualisiert (via `pnpm install`)
