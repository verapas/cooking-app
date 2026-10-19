# API-Dokumentation

Base URL: `http://localhost:5173/api`

## Authentifizierung

Es gibt **keine App-Level-Authentifizierung** mehr (Auth-Tabellen wurden mit `V4__drop_auth.sql` entfernt). Alle Endpunkte sind auf App-Ebene offen — der Zugriffsschutz liegt vollständig auf Infrastrukturebene (Reverse Proxy / VPN, siehe `INFRA.md`). Der Container sollte nie direkt aus dem Internet erreichbar sein.

## Kategorien

### Liste aller Kategorien

```http
GET /api/categories
```

Response:
```json
[
  {
    "id": 1,
    "name": "Suppen",
    "slug": "suppen",
    "icon": "🍲",
    "sort_order": 1
  }
]
```

### Kategorie erstellen

```http
POST /api/categories
Content-Type: application/json

{
  "name": "Suppen",
  "slug": "suppen",
  "icon": "🍲",
  "sort_order": 1
}
```

Response:
```json
{
  "id": 1
}
```

Status: `201 Created`

### Kategorie aktualisieren

```http
PUT /api/categories/1
Content-Type: application/json

{
  "name": "Suppen Deluxe",
  "icon": "🥣",
  "sort_order": 1
}
```

Response:
```json
{
  "ok": true
}
```

### Kategorie löschen

```http
DELETE /api/categories/1
```

Response:
```json
{
  "ok": true
}
```

**Hinweis:** Beim Löschen einer Kategorie wird `category_id` der zugehörigen Rezepte auf `NULL` gesetzt (ON DELETE SET NULL).

## Rezepte

### Rezept-Versionen

Das System unterstützt Rezept-Varianten (z.B. "Übernacht garen", "Schnelle Version"). Jedes Rezept kann entweder:
- Ein Hauptrezept sein (`parent_recipe_id IS NULL`)
- Eine Variante eines Hauptrezepts sein (`parent_recipe_id` verweist auf das Hauptrezept)

Hauptrezepte werden in der Hauptliste angezeigt. Varianten werden nur über den Versions-Dropdown im Rezept-Detail erreichbar.

### Liste aller Rezepte (nur Hauptrezepte)

```http
GET /api/recipes
GET /api/recipes?category_id=1
GET /api/recipes?q=Tomate
GET /api/recipes?tag_ids=3,7
GET /api/recipes?limit=30&offset=30
```

Query-Parameter (alle optional, kombinierbar):
- `category_id` — nach Kategorie filtern
- `q` — Freitextsuche in Titel und Beschreibung
- `tag_ids` — Komma-separierte Tag-IDs, **UND-Verknüpft über die
  Rezept-Familie**: Ein Hauptrezept erscheint im Ergebnis, wenn für
  *jeden* gewählten Tag *irgendeine* Version (Hauptrezept oder Variante)
  das Tag trägt.
- `limit` / `offset` — Pagination für „Mehr laden" (Limit 1–100)

Sortierung: Pins zuerst (`is_pinned DESC, pinned_at DESC`), dann Favoriten,
dann Titel.

Response:
```json
[
  {
    "id": 1,
    "title": "Tomatensuppe",
    "description": "Lecker",
    "category_id": 1,
    "category_name": "Supen",
    "category_slug": "suppen",
    "base_servings": 2,
    "prep_time_min": 5,
    "cook_time_min": 20,
    "image_url": "/images/recipe-1-1234567890.jpg",
    "source": null,
    "is_favorite": false,
    "is_pinned": false,
    "pinned_at": null,
    "tags": [],
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z"
  }
]
```

**Hinweis:** Listen-Endpoints liefern `tags` immer als leeres Array — Tags
werden nur im Rezept-Detail (`GET /api/recipes/[id]`) und im Edit-Formular
geladen.

### Rezept erstellen (Hauptrezept)

```http
POST /api/recipes
Content-Type: application/json

{
  "title": "Tomatensuppe",
  "description": "Lecker",
  "category_slug": "suppen",
  "base_servings": 2,
  "prep_time_min": 5,
  "cook_time_min": 20,
  "tags": ["vegetarisch", "schnell"],
  "steps": [
    {
      "order": 1,
      "instruction": "Zwiebeln würfeln und im Olivenöl andünsten."
    },
    {
      "order": 2,
      "instruction": "Passierte Tomaten und Gemüsebrühe zugeben.",
      "duration_sec": 600
    }
  ],
  "ingredients": [
    {
      "name": "Zwiebeln",
      "quantity": 1,
      "unit": "Stück",
      "step_order": 1,
      "sort_order": 0
    },
    {
      "name": "Olivenöl",
      "quantity": 1,
      "unit": "EL",
      "step_order": 1,
      "sort_order": 1
    },
    {
      "name": "Passierte Tomaten",
      "quantity": 500,
      "unit": "g",
      "step_order": 2,
      "sort_order": 2
    }
  ]
}
```

Response:
```json
{
  "id": 1
}
```

Status: `201 Created`

**Hinweis zu `tags`:** Namen werden per Get-or-Create angelegt (case-insensitiv
dedupliziert über die DB-Collation, max. 40 Zeichen, max. 10 pro Rezept).
Fehlt das Feld beim `PUT`, werden alle Tags des Rezepts entfernt.

```http
POST /api/recipes
Content-Type: application/json

{
  "title": "Tomatensuppe",
  "parent_recipe_id": 1,
  "version_name": "Übernacht garen",
  "description": "Länger ziehen lassen für mehr Geschmack",
  "category_slug": "suppen",
  "base_servings": 4,
  "prep_time_min": 10,
  "cook_time_min": 240,
  "steps": [
    {
      "order": 1,
      "instruction": "Zwiebeln und Knoblauch im Olivenöl andünsten."
    },
    {
      "order": 2,
      "instruction": "Passierte Tomaten und Gemüsebrühe zugeben. 4 Stunden köcheln lassen."
    }
  ],
  "ingredients": [
    {
      "name": "Zwiebeln",
      "quantity": 2,
      "unit": "Stück",
      "step_order": 1,
      "sort_order": 0
    }
  ]
}
```

Response:
```json
{
  "id": 5
}
```

Status: `201 Created`

**Wichtig:**
- `parent_recipe_id`: ID des Hauptrezepts (Pflicht für Varianten)
- `version_name`: Name der Variante (Pflicht für Varianten, z.B. "Übernacht garen")
- Varianten erben das Bild des Hauptrezepts (kann überschrieben werden)
- Die Liste zeigt nur Hauptrezepte an

### Einzelnes Rezept abrufen

```http
GET /api/recipes/1
```

Response:
```json
{
  "id": 1,
  "title": "Tomatensuppe",
  "description": "Lecker",
  "category_id": 1,
  "category": {
    "id": 1,
    "name": "Suppen",
    "slug": "suppen",
    "icon": "🍲"
  },
  "base_servings": 2,
  "prep_time_min": 5,
  "cook_time_min": 20,
  "image_url": "/images/recipe-1-1234567890.jpg",
  "source": null,
  "is_favorite": false,
  "is_pinned": false,
  "pinned_at": null,
  "tags": ["vegetarisch"],
  "created_at": "2024-01-01T12:00:00.000Z",
  "updated_at": "2024-01-01T12:00:00.000Z",
  "steps": [
    {
      "id": 1,
      "recipe_id": 1,
      "order": 1,
      "instruction": "Zwiebeln würfeln und im Olivenöl andünsten.",
      "duration_sec": null
    },
    {
      "id": 2,
      "recipe_id": 1,
      "order": 2,
      "instruction": "Passierte Tomaten und Gemüsebrühe zugeben.",
      "duration_sec": 600
    }
  ],
  "ingredients": [
    {
      "id": 1,
      "recipe_id": 1,
      "step_id": 1,
      "name": "Zwiebeln",
      "quantity": 1,
      "unit": "Stück",
      "sort_order": 0
    }
  ]
}
```

### Rezept aktualisieren

```http
PUT /api/recipes/1
Content-Type: application/json

{
  "title": "Tomatensuppe Deluxe",
  "description": "Noch leckerer",
  "category_slug": "suppen",
  "base_servings": 4,
  "tags": ["vegetarisch", "schnell"]
}
```

Response:
```json
{
  "id": 1
}
```

**Hinweis:** `PUT` ersetzt das Rezept vollständig (Steps/Zutaten/Tags werden
erneuert) — immer das komplette Objekt schicken, wie es der Client kennt.

### Rezept-Varianten auflisten

```http
GET /api/recipes/1/versions
```

Response:
```json
[
  {
    "id": 1,
    "version_name": null,
    "is_main": true
  },
  {
    "id": 5,
    "version_name": "Übernacht garen",
    "is_main": false
  }
]
```

**Hinweis:** Die Hauptversion wird immer zuerst angezeigt.

### Rezept löschen

```http
DELETE /api/recipes/1
```

Response:
```json
{
  "ok": true
}
```

## Favoriten & Pins

### Favoriten auflisten

```http
GET /api/favorites
```

Response:
```json
[
  {
    "id": 1,
    "title": "Tomatensuppe",
    "description": "Lecker",
    "category_id": 1,
    "category_name": "Suppen",
    "category_slug": "suppen",
    "base_servings": 2,
    "prep_time_min": 5,
    "cook_time_min": 20,
    "image_url": "/images/recipe-1-1234567890.jpg",
    "source": null,
    "is_favorite": true,
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z"
  }
]
```

### Favorit-Status umschalten

```http
POST /api/recipes/1/favorite
```

Response:
```json
{
  "ok": true
}
```

Schaltet den Favorit-Status eines Rezepts um (aus/an).

### Pin-Status umschalten („heute kochen")

```http
POST /api/recipes/1/pin
```

Response:
```json
{
  "ok": true
}
```

Schaltet den Pin um: Anpinnen setzt `is_pinned = 1` und `pinned_at = NOW()`,
Lösen setzt beides zurück. Angepinnte Rezept stehen in allen Listen zuoberst
(vor den Favoriten) und werden orange hervorgehoben.

## Tags

Querschnitts-Merkmale über Kategorien hinweg (z. B. „vegetarisch", „schnell").
Verwaltet unter Einstellungen → Tags; beim Rezept-Speichern werden neue Namen
automatisch angelegt (Get-or-Create, case-insensitiv dedupliziert).

### Alle Tags auflisten

```http
GET /api/tags
```

Response:
```json
[
  { "id": 1, "name": "schnell", "count": 3 },
  { "id": 2, "name": "vegetarisch", "count": 5 }
]
```

`count` = Anzahl Rezept-**Familien** (Hauptrezept + Varianten zusammengezählt),
passend zur Filter-Semantik von `GET /api/recipes?tag_ids=`.

### Tag erstellen

```http
POST /api/tags
Content-Type: application/json

{ "name": "vegetarisch" }
```

Response:
```json
{ "id": 2, "name": "vegetarisch" }
```

Status: `201 Created`. Duplikate (case-insensitiv) sind idempotent — der
vorhandene Tag wird zurückgegeben.

### Tag umbenennen

```http
PUT /api/tags/2
Content-Type: application/json

{ "name": "vegan" }
```

Response:
```json
{ "id": 2, "name": "vegan" }
```

### Tag löschen

```http
DELETE /api/tags/2
```

Response:
```json
{ "ok": true }
```

Verknüpfungen zu Rezepten fallen per `ON DELETE CASCADE` mit weg.

## Bilder

### Bild hochladen

```http
POST /api/recipes/1/image
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="image"; filename="suppe.jpg"
Content-Type: image/jpeg

[binary data]
------WebKitFormBoundary--
```

Erlaubte Formate: JPG, PNG, WebP, GIF (max. 20 MB)

Response:
```json
{
  "image_url": "/images/recipe-1-1234567890.jpg"
}
```

Löscht automatisch das alte Bild, wenn vorhanden.

## Datenstrukturen

### Category

```typescript
{
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
}
```

### Recipe

```typescript
{
  id: number;
  title: string;
  description: string | null;
  category_id: number | null;
  base_servings: number;
  prep_time_min: number | null;
  cook_time_min: number | null;
  image_url: string | null;
  source: string | null;
  is_favorite: boolean;
  is_pinned: boolean;       // „heute kochen" — steht in Listen zuoberst
  pinned_at: string | null;
  tags: string[];           // Tag-Namen (nur im Detail gefüllt, Listen: [])
  parent_recipe_id: number | null;
  version_name: string | null;
  created_at: string;
  updated_at: string;
}
```

### Tag

```typescript
{
  id: number;
  name: string;
  count?: number; // nur von GET /api/tags: Anzahl Rezept-Familien
}
```

### RecipeVersion

```typescript
{
  id: number;
  version_name: string | null;
  is_main: boolean;
}
```

### Ingredient

```typescript
{
  id: number;
  recipe_id: number;
  step_id: number | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  sort_order: number;
}
```

### Step

```typescript
{
  id: number;
  recipe_id: number;
  order: number;
  instruction: string;
  duration_sec: number | null;
}
```

## Fehlercodes

- `400 Bad Request` - Ungültiges JSON oder fehlende Felder
- `404 Not Found` - Ressource nicht gefunden
- `413 Payload Too Large` - Bild zu groß (max. 20 MB)
- `415 Unsupported Media Type` - Falsches Bildformat
- `422 Unprocessable Entity` - Validierungsfehler
- `503 Service Unavailable` - Server nicht konfiguriert

## Hinweise

- `quantity` muss numerisch sein für Portionen-Skalierung
- `0` oder `null` bei quantity = "nach Geschmack" (Menge wird ausgeblendet)
- `step_order` ordnet Zutaten einem Schritt zu (1-basiert nach `order`)
- `duration_sec` aktiviert den Timer im Stepper
- Kategorie kann per `category_id` oder `category_slug` angegeben werden
- Tags können beliebiger `string[]`-Namen sein — Validierung/Grenzen siehe
  „Rezept erstellen" oben (40 Zeichen, max. 10)