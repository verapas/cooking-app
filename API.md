# API-Dokumentation

Base URL: `http://localhost:5173/api`

## Authentifizierung

Alle schreibenden Endpoints (POST, PUT, DELETE) erfordern eine gültige Session. Die Session wird über ein HttpOnly Cookie verwaltet.

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "dein-passwort"
}
```

Response:
```json
{
  "success": true
}
```

Setzt ein `session` Cookie (HttpOnly, 7 Tage gültig).

### Logout

```http
POST /api/auth/logout
```

Löscht das Session-Cookie.

### Verify Session

```http
GET /api/auth/verify
```

Response:
```json
{
  "ok": true
}
```

Gibt `401` zurück, wenn keine gültige Session vorhanden.

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
    "is_favorite": false,
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z"
  }
]
```

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

### Rezept-Variante erstellen

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
  "base_servings": 4
}
```

Response:
```json
{
  "id": 1
}
```

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

## Favoriten

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

Erlaubte Formate: JPG, PNG, WebP, GIF (max. 5 MB)

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
  parent_recipe_id: number | null;
  version_name: string | null;
  created_at: string;
  updated_at: string;
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
- `401 Unauthorized` - Keine gültige Session
- `404 Not Found` - Ressource nicht gefunden
- `413 Payload Too Large` - Bild zu groß (max. 5 MB)
- `415 Unsupported Media Type` - Falsches Bildformat
- `422 Unprocessable Entity` - Validierungsfehler
- `503 Service Unavailable` - Server nicht konfiguriert

## Hinweise

- `quantity` muss numerisch sein für Portionen-Skalierung
- `0` oder `null` bei quantity = "nach Geschmack" (Menge wird ausgeblendet)
- `step_order` ordnet Zutaten einem Schritt zu (1-basiert nach `order`)
- `duration_sec` aktiviert den Timer im Stepper
- Kategorie kann per `category_id` oder `category_slug` angegeben werden
- Session läuft nach 7 Tagen ab (kann in `src/lib/components/NavDrawer.svelte` angepasst werden)