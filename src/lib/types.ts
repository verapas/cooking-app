// === Geteilte Typen für Rezept-Daten ===

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

export interface Recipe {
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
