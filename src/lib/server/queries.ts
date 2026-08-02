// === Query-Funktionen (server-only) ===
// Dünne Schicht über better-sqlite3, genutzt von Load-Funktionen und API-Routen.

import { db } from './db';
import type {
  Category,
  CategoryInput,
  CategoryUpdateInput,
  Ingredient,
  RecipeInput,
  RecipeListItem,
  RecipeWithDetails,
  RecipeVersion,
  Step
} from '$lib/types';

// ---------- Kategorien ----------

export function listCategories(): Category[] {
  return db
    .prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC')
    .all() as Category[];
}

export function getCategoryBySlug(slug: string): Category | null {
  return (
    (db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug) as
      | Category
      | undefined) ?? null
  );
}

export function createCategory(input: CategoryInput): number {
  const info = db
    .prepare(
      `INSERT INTO categories (name, slug, icon, sort_order) VALUES (?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET name=excluded.name, icon=excluded.icon, sort_order=excluded.sort_order`
    )
    .run(input.name, input.slug, input.icon ?? null, input.sort_order ?? 0);
  return Number(info.lastInsertRowid);
}

export function updateCategory(id: number, input: CategoryUpdateInput): boolean {
  const updates: string[] = [];
  const params: unknown[] = [];
  
  if (input.name !== undefined) {
    updates.push('name = ?');
    params.push(input.name);
  }
  if (input.slug !== undefined) {
    updates.push('slug = ?');
    params.push(input.slug);
  }
  if (input.icon !== undefined) {
    updates.push('icon = ?');
    params.push(input.icon);
  }
  if (input.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(input.sort_order);
  }
  
  if (updates.length === 0) return false;
  
  params.push(id);
  const res = db
    .prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`)
    .run(...params);
  
  return res.changes > 0;
}

export function deleteCategory(id: number): boolean {
  const res = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return res.changes > 0;
}

// ---------- Rezepte: Listen ----------

export function listRecipes(opts?: {
  categoryId?: number;
  q?: string;
  limit?: number;
}): RecipeListItem[] {
  const where: string[] = ['r.parent_recipe_id IS NULL'];
  const params: unknown[] = [];
  if (opts?.categoryId != null) {
    where.push('r.category_id = ?');
    params.push(opts.categoryId);
  }
  if (opts?.q) {
    where.push('(r.title LIKE ? OR r.description LIKE ?)');
    params.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = opts?.limit ?? 200;
  const results = db
    .prepare(
      `SELECT r.*, c.name AS category_name, c.slug AS category_slug
       FROM recipes r
       LEFT JOIN categories c ON c.id = r.category_id
       ${clause}
       ORDER BY r.is_favorite DESC, r.title ASC, r.created_at DESC
       LIMIT ?`
    )
    .all(...params, limit) as (Omit<RecipeListItem, 'is_favorite'> & { is_favorite: number })[];
  
  return results.map(r => ({ ...r, is_favorite: Boolean(r.is_favorite) }));
}

export function searchRecipes(q: string): RecipeListItem[] {
  return listRecipes({ q, limit: 50 });
}

export function listFavorites(): RecipeListItem[] {
  const results = db
    .prepare(
      `SELECT r.*, c.name AS category_name, c.slug AS category_slug
       FROM recipes r
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.is_favorite = 1 AND r.parent_recipe_id IS NULL
       ORDER BY r.created_at DESC`
    )
    .all() as (Omit<RecipeListItem, 'is_favorite'> & { is_favorite: number })[];
  
  return results.map(r => ({ ...r, is_favorite: Boolean(r.is_favorite) }));
}

export function toggleFavorite(id: number): boolean {
  const recipe = db.prepare('SELECT is_favorite FROM recipes WHERE id = ?').get(id) as { is_favorite: number } | undefined;
  if (!recipe) return false;
  
  const newFavorite = recipe.is_favorite ? 0 : 1;
  const res = db.prepare('UPDATE recipes SET is_favorite = ? WHERE id = ?').run(newFavorite, id);
  return res.changes > 0;
}

export function countRecipes(): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM recipes WHERE parent_recipe_id IS NULL').get() as { n: number };
  return row.n;
}

// ---------- Rezepte: Versioning ----------

export function getMainRecipeId(recipeId: number): number | null {
  const recipe = db.prepare('SELECT parent_recipe_id FROM recipes WHERE id = ?').get(recipeId) as { parent_recipe_id: number | null } | undefined;
  if (!recipe) return null;
  if (recipe.parent_recipe_id === null) return recipeId;
  return recipe.parent_recipe_id;
}

export function listRecipeVersions(parentId: number): RecipeVersion[] {
  const versions = db
    .prepare(
      `SELECT id, version_name FROM recipes WHERE id = ? OR parent_recipe_id = ? ORDER BY id ASC`
    )
    .all(parentId, parentId) as { id: number; version_name: string | null }[];

  return versions.map((v) => ({
    id: v.id,
    version_name: v.version_name,
    is_main: v.id === parentId
  }));
}

export function getRecipeWithVersion(recipeId: number, versionId: number): RecipeWithDetails | null {
  return getRecipe(versionId);
}

export function getEffectiveImageUrl(recipeId: number): string | null {
  const row = db
    .prepare('SELECT image_url, parent_recipe_id FROM recipes WHERE id = ?')
    .get(recipeId) as { image_url: string | null; parent_recipe_id: number | null } | undefined;
  if (!row) return null;
  if (row.image_url) return row.image_url;
  if (row.parent_recipe_id != null) {
    const parent = db
      .prepare('SELECT image_url FROM recipes WHERE id = ?')
      .get(row.parent_recipe_id) as { image_url: string | null } | undefined;
    return parent?.image_url ?? null;
  }
  return null;
}

// ---------- Rezepte: Detail ----------

export function getRecipe(id: number): RecipeWithDetails | null {
  const recipe = db
    .prepare(
      `SELECT r.*, c.id AS c_id, c.name AS c_name, c.slug AS c_slug, c.icon AS c_icon
       FROM recipes r
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.id = ?`
    )
    .get(id) as
    | (Record<string, unknown> & {
        c_id: number | null;
        c_name: string | null;
        c_slug: string | null;
        c_icon: string | null;
        is_favorite: number;
      })
    | undefined;

  if (!recipe) return null;

  const { c_id, c_name, c_slug, c_icon, is_favorite, ...rest } = recipe;
  const ingredients = db
    .prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_order ASC, id ASC')
    .all(id) as Ingredient[];
  const steps = db
    .prepare('SELECT * FROM steps WHERE recipe_id = ? ORDER BY "order" ASC, id ASC')
    .all(id) as Step[];

  return {
    ...(rest as Omit<RecipeWithDetails, 'category' | 'ingredients' | 'steps' | 'is_favorite'>),
    is_favorite: Boolean(is_favorite),
    category:
      c_id != null
        ? { id: c_id, name: c_name!, slug: c_slug!, icon: c_icon }
        : null,
    ingredients,
    steps
  };
}

// ---------- Rezepte: Schreiben ----------

function resolveCategoryId(input: RecipeInput): number | null {
  if (input.category_id != null) return input.category_id;
  if (input.category_slug) {
    const cat = db
      .prepare('SELECT id FROM categories WHERE slug = ?')
      .get(input.category_slug) as { id: number } | undefined;
    return cat?.id ?? null;
  }
  return null;
}

export function createRecipe(input: RecipeInput): number {
  const run = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO recipes
         (title, description, category_id, base_servings, prep_time_min, cook_time_min, image_url, source, parent_recipe_id, version_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.title,
        input.description ?? null,
        resolveCategoryId(input),
        input.base_servings ?? 2,
        input.prep_time_min ?? null,
        input.cook_time_min ?? null,
        input.image_url ?? null,
        input.source ?? null,
        input.parent_recipe_id ?? null,
        input.version_name ?? null
      );
    const recipeId = Number(info.lastInsertRowid);

    if (input.parent_recipe_id && !input.image_url) {
      const parent = db.prepare('SELECT image_url FROM recipes WHERE id = ?').get(input.parent_recipe_id) as { image_url: string | null } | undefined;
      if (parent?.image_url) {
        db.prepare('UPDATE recipes SET image_url = ? WHERE id = ?').run(parent.image_url, recipeId);
      }
    }

    insertChildren(recipeId, input);
    return recipeId;
  });
  return run();
}

export function updateRecipe(id: number, input: RecipeInput): boolean {
  const run = db.transaction(() => {
    const res = db
      .prepare(
        `UPDATE recipes SET
           title = ?, description = ?, category_id = ?, base_servings = ?,
           prep_time_min = ?, cook_time_min = ?, image_url = ?, source = ?, version_name = ?
         WHERE id = ?`
      )
      .run(
        input.title,
        input.description ?? null,
        resolveCategoryId(input),
        input.base_servings ?? 2,
        input.prep_time_min ?? null,
        input.cook_time_min ?? null,
        input.image_url ?? null,
        input.source ?? null,
        input.version_name ?? null,
        id
      );
    if (res.changes === 0) return false;
    db.prepare('DELETE FROM steps WHERE recipe_id = ?').run(id);
    db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(id);
    insertChildren(id, input);
    return true;
  });
  return run();
}

export function deleteRecipe(id: number): boolean {
  const res = db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  return res.changes > 0;
}

/** Legt Schritte + Zutaten für ein bestehendes Rezept an. */
function insertChildren(recipeId: number, input: RecipeInput): void {
  const orderToStepId = new Map<number, number>();
  const steps = [...(input.steps ?? [])].sort((a, b) => a.order - b.order);
  for (const s of steps) {
    const info = db
      .prepare(
        `INSERT INTO steps (recipe_id, "order", instruction, duration_sec) VALUES (?, ?, ?, ?)`
      )
      .run(recipeId, s.order, s.instruction, s.duration_sec ?? null);
    orderToStepId.set(s.order, Number(info.lastInsertRowid));
  }

  const ings = input.ingredients ?? [];
  ings.forEach((ing, i) => {
    const stepId =
      ing.step_order != null ? orderToStepId.get(ing.step_order) ?? null : null;
    db.prepare(
      `INSERT INTO ingredients (recipe_id, step_id, name, quantity, unit, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(recipeId, stepId, ing.name, ing.quantity ?? null, ing.unit ?? null, ing.sort_order ?? i);
  });
}
