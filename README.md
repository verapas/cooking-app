# Koch-App 🍳

Mobile-first Web-App für Kochrezepte, gebaut mit **SvelteKit + SQLite**.
Läuft als Node-Prozess (`adapter-node`) – z.&nbsp;B. auf einem Proxmox-Server.

## Features

- 📱 Mobile-first, Dark-Theme (Koch-Modus – blendet beim Kochen nicht)
- 🗂️ Kategorien-Navigation (Frühstück, Hauptgericht, …)
- 📖 Rezept-Detail in zwei Ansichten:
  - **Klassisch**: komplette Zutatenliste + nummerierte Schritte
  - **Schritt für Schritt**: iterierbarer Stepper mit **aktivem Timer**
    (Signalton, Vibration, Bildschirm-Wachhaltung)
- 🔢 **Portionen-Umschalter**: alle Mengen skalieren live mit
- 🔌 **REST-API** zum Anlegen/Ändern/Löschen von Rezepten
  (z.&nbsp;B. für eine LLM-/Agent-Instanz wie Open Claw)

## Stack

- SvelteKit 2 + Svelte 5 (Runes) + TypeScript
- SQLite via `better-sqlite3` (nur server-seitig)
- `@sveltejs/adapter-node`

## Entwicklung

```bash
pnpm install
cp .env.example .env      # dann COOKING_API_TOKEN setzen!
pnpm dev                  # http://localhost:5173
pnpm check                # Typecheck
```

## Produktion / Deploy (Proxmox)

```bash
pnpm build                # erzeugt build/
COOKING_API_TOKEN=<token> \
DATABASE_PATH=/var/lib/cooking-app/db.sqlite \
PORT=3000 \
node build
```

Der Server lauscht auf `PORT` (default 3000). Hinter einem Reverse-Proxy
(Nginx/Caddy) betreiben und `ORIGIN` auf die öffentliche URL setzen.

## API (für Open Claw / Agenten)

Schreibzugriffe (POST/PUT/DELETE) benötigen
`Authorization: Bearer <COOKING_API_TOKEN>`. GET ist offen.

| Methode | Route | Beschreibung |
| --- | --- | --- |
| GET | `/api/recipes?category_id=&q=` | Rezept-Liste |
| GET | `/api/recipes/:id` | Rezept-Detail (mit Zutaten + Schritten) |
| POST | `/api/recipes` | Rezept anlegen |
| PUT | `/api/recipes/:id` | Rezept ändern |
| DELETE | `/api/recipes/:id` | Rezept löschen |
| GET | `/api/categories` | Kategorien |
| POST | `/api/categories` | Kategorie anlegen |

### Beispiel: Rezept anlegen

```bash
curl -X POST http://localhost:3000/api/recipes \
  -H "Authorization: Bearer $COOKING_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tomaten-Mozzarella-Pasta",
    "category_slug": "hauptgericht",
    "base_servings": 2,
    "steps": [
      {"order": 1, "instruction": "Pasta kochen.", "duration_sec": 600},
      {"order": 2, "instruction": "Tomaten anbraten, Mozzarella unterheben."}
    ],
    "ingredients": [
      {"name": "Spaghetti",   "quantity": 200, "unit": "g", "step_order": 1},
      {"name": "Kirschtomaten","quantity": 250, "unit": "g", "step_order": 2},
      {"name": "Mozzarella",  "quantity": 125, "unit": "g", "step_order": 2}
    ]
  }'
```

- `quantity` **muss numerisch** sein (sonst kann nicht skaliert werden).
  `0`/`null` bedeutet „nach Geschmack“ – die Menge wird dann ausgeblendet.
- `step_order` ordnet eine Zutat einem Schritt zu (1-basiert, nach `order`).
  Fehlt der Wert, erscheint die Zutat in der globalen Zutatenliste.
- `duration_sec` aktiviert den Timer für diesen Schritt.

## Datenmodell

`categories` → `recipes` → `steps` / `ingredients` (Zutaten sind optional
einem Schritt zugeordnet). Details siehe `src/lib/server/db.ts`.
