# =====================================================================
# Koch-App — Multi-Stage Dockerfile
# =====================================================================
# SvelteKit wird via adapter-node zu einem einzelnen Node-Prozess
# gebaut (Frontend + Backend im selben Artefakt). Frontend und Backend
# teilen sich denselben Container — nur die Datenbank (MariaDB) läuft
# extern als eigener Service (siehe deploy/compose.example.yaml).
#
# Base-Image: node:22-bookworm-slim. Absichtlich NICHT Alpine: mysql2
# ist reines JS, aber etliche transitive Deps (z. B. canvas beim Build)
# profitieren von glibc-Prebuilds. Auf musl müssten einzelne per
# node-gyp kompiliert werden.
# =====================================================================

# --- Gemeinsame Basis: nur Corepack aktivieren, nichts installieren. ---
# Frühere Version installierte hier schon alle Deps — das blähte jede
# nachfolgende Stage unnötig auf. Jede Stage installiert selbst.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

# =====================================================================
# Stage 1: build  — Source bauen (Typecheck + Production-Build)
# =====================================================================
FROM base AS build
WORKDIR /app

# Erst nur die Manifest-Dateien kopieren → pnpm install cacht gut.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# BuildKit-Cache-Mount für den pnpm-Store (lokal, nicht extern).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Jetzt den Source + Config kopieren. vite.config.ts (nicht .js!) und
# svelte.config.js werden für `pnpm build` gebraucht, static/ für die
# PWA-Icons (SvelteKit-Konvention für am Root ausgelieferte Assets —
# NICHT public/, das ist die Vite-Konvention und wird von SvelteKit
# ignoriert), src/ für die App, db/migration/ landet zwar nicht im
# Build-Output, wird aber vom Flyway-Container benötigt (siehe Phase 4).
COPY tsconfig.json svelte.config.js vite.config.ts ./
COPY src src
COPY static static
COPY db db

# Typecheck + Produktions-Build. Schlägt der Typecheck fehl, bricht der
# Build — gewollt (kein Image mit Typfehlern ausliefern).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm check && pnpm build

# =====================================================================
# Stage 2: prod-deps  — Nur Runtime-Dependencies
# =====================================================================
# Separate Stage, damit devDependencies (svelte-check, vite, typescript
# etc.) NICHT ins Runtime-Image gelangen.
FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

# =====================================================================
# Stage 3: final  — Runtime-Image
# =====================================================================
FROM base AS final
WORKDIR /app

# Runtime-Dependencies (ohne devDeps), der gebaute Adapter-node-Output
# und die package.json (fürs Modul-Resolution). db/migration/ wird hier
# NICHT gebraucht — die App migriert nicht selbst, der Flyway-Container
# in der Compose übernimmt das. Aber package.json brauchen wir, damit
# `node build` seine Deps findet.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./

# Datenverzeichnis für hochgeladene Bilder anlegen (DB ist extern in
# MariaDB → /data enthält NUR noch Bilder). Non-Root-User setzen.
RUN mkdir -p /data/images && \
    chown -R node:node /data && \
    chmod -R 755 /data

# Runtime-Env. DATABASE_PATH entfällt (MariaDB hat keine Datei).
# DB_HOST etc. werden zur Laufzeit von außen gesetzt (Compose/env_file).
# BODY_SIZE_LIMIT=25M: adapter-node limitiert Bodies sonst auf 512 KB,
# der 20-MB-Bild-Upload aus POST /api/recipes/[id]/image scheitert mit 413.
ENV PORT=3000 \
    IMAGES_DIR=/data/images \
    BODY_SIZE_LIMIT=25M \
    DB_HOST=mariadb \
    DB_PORT=3306 \
    DB_NAME=cooking \
    DB_USER=cooking

USER node
VOLUME ["/data"]
EXPOSE 3000

# Healthcheck ohne curl (nicht im slim-Image). /login ist in der
# publicPaths-Liste in hooks.server.ts und liefert ohne Session 200.
# process.exit: ok→0, non-ok→1, fetch-Fehler→1.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/login').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "build"]
