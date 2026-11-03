// === Geteilte Typen für Rezept-Daten ===

/** Angemeldeter Benutzer (OIDC/Keycloak) — Quelle: sessions/users-Tabellen,
 *  siehe src/lib/server/auth.ts. Anzeige: name || username || email. */
export interface SessionUser {
  id: number;
  username: string | null;
  email: string | null;
  name: string | null;
  /** App-Admin (Phase 2: Benutzerverwaltung) — gesetzt via V10-Backfill/SQL. */
  is_admin: boolean;
}

/** Rolle eines Benutzers in einem Space. */
export type SpaceRole = 'owner' | 'member';

/** Der aktive Space des Benutzers — Scope für alle Daten-Queries
 *  (hooks.server.ts löst ihn auf und legt ihn in locals.space ab). */
export interface ActiveSpace {
  id: number;
  name: string;
  role: SpaceRole;
}

/** Benutzer mit Mitgliedschaften — Datenlage für /admin. */
export interface AdminUser {
  id: number;
  username: string | null;
  email: string | null;
  name: string | null;
  is_admin: boolean;
  active_space_id: number | null;
  last_login_at: string | null;
  created_at: string;
  memberships: { space_id: number; space_name: string; role: SpaceRole }[];
}

/** Space mit Mitgliedern und Rezept-Zähler — Datenlage für /admin. */
export interface AdminSpace {
  id: number;
  name: string;
  created_at: string;
  recipe_count: number;
  members: {
    user_id: number;
    username: string | null;
    name: string | null;
    role: SpaceRole;
    /** true, wenn dieser Space gerade der aktive Space des Mitglieds ist. */
    is_active_space: boolean;
  }[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
}

/** Küchenausstattung der Person (z. B. Ofen, Airfryer) — KI-Kontext. */
export interface KitchenTool {
  id: number;
  name: string;
}

/** Querschnitts-Merkmal für Rezepte (z. B. „vegetarisch", „schnell"). */
export interface Tag {
  id: number;
  name: string;
}

/** Tag mit Anzahl passender Rezept-Familien (Filter/Einstellungen). */
export interface TagWithCount extends Tag {
  count: number;
}

export interface Recipe {
  id: number;
  /** Space, zu dem das Rezept gehört (V10) — Zeile trägt die Spalte seitdem. */
  space_id: number;
  title: string;
  description: string | null;
  category_id: number | null;
  base_servings: number;
  prep_time_min: number | null;
  cook_time_min: number | null;
  image_url: string | null;
  source: string | null;
  is_favorite: boolean;
  /** Pin („heute kochen"): steht in Listen zuoberst, orange hervorgehoben. */
  is_pinned: boolean;
  pinned_at: string | null;
  /** Veröffentlicht (Phase 3 „Öffentlich"): im öffentlichen Bereich sichtbar. */
  is_published: boolean;
  published_at: string | null;
  /** Urheber (users.id) — für Anzeige „von wem" im öffentlichen Bereich. */
  created_by: number | null;
  /** Tag-Namen dieses Rezepts (Hauptrezept und Varianten können eigene haben). */
  tags: string[];
  parent_recipe_id: number | null;
  version_name: string | null;
  created_at: string;
  updated_at: string;
}

/** Rezept-Zeile angereichert um Kategoriename/-slug (für Listen/Card). */
export interface RecipeListItem extends Recipe {
  category_name: string | null;
  category_slug: string | null;
}

export interface Ingredient {
  id: number;
  recipe_id: number;
  step_id: number | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  sort_order: number;
}

export interface Step {
  id: number;
  recipe_id: number;
  order: number;
  instruction: string;
  duration_sec: number | null;
}

export interface RecipeWithDetails extends Recipe {
  category: Pick<Category, 'id' | 'name' | 'slug' | 'icon'> | null;
  ingredients: Ingredient[];
  steps: Step[];
}

// === Eingabe-Typen für die API (Open Claw) ===

/** Veröffentlichtes Rezept im öffentlichen Bereich (Phase 3 „Öffentlich") —
 *  Rezept aus einem beliebigen Space, mit Attribution. */
export interface PublishedListItem extends RecipeListItem {
  /** Urheber-Anzeige: Vorname (persönlicher Space, 1 Mitglied) oder
   *  Space-Name (geteilter Space, z. B. „Familie") — oder null. */
  author_label: string | null;
}

/** Detail eines veröffentlichten Rezepts (öffentliche Detailseite). */
export interface PublishedRecipe extends RecipeWithDetails {
  author_label: string | null;
}

export interface IngredientInput {
  name: string;
  /** numerische Menge — nötig damit Portionen skaliert werden können */
  quantity?: number | null;
  unit?: string | null;
  /**
   * 1-basierter `order`-Wert des Schritts, dem diese Zutat zugeordnet ist.
   * Fehlt der Wert, erscheint die Zutat in der globalen Zutatenliste.
   */
  step_order?: number | null;
  sort_order?: number;
}

export interface StepInput {
  order: number;
  instruction: string;
  /** Sekunden für den Timer dieses Schritts (optional). */
  duration_sec?: number | null;
}

export interface RecipeInput {
  title: string;
  description?: string | null;
  /** Kategorie entweder per id oder per slug angeben. */
  category_id?: number | null;
  category_slug?: string | null;
  base_servings?: number;
  prep_time_min?: number | null;
  cook_time_min?: number | null;
  image_url?: string | null;
  source?: string | null;
  /** Für Varianten: ID des Elternrezepts */
  parent_recipe_id?: number | null;
  /** Für Varianten: Name der Version (z.B. "Übernacht garen") */
  version_name?: string | null;
  /** Tag-Namen — werden per Get-or-Create angelegt und verknüpft. */
  tags?: string[];
  ingredients?: IngredientInput[];
  steps?: StepInput[];
}

export interface RecipeVersion {
  id: number;
  version_name: string | null;
  is_main: boolean;
}

export interface CategoryInput {
  name: string;
  slug: string;
  icon?: string | null;
  sort_order?: number;
}

export interface CategoryUpdateInput {
  name?: string;
  slug?: string;
  icon?: string | null;
  sort_order?: number;
}
