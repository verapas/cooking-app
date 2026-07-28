// === Query-Funktionen (server-only) ===
// Dünne Schicht über better-sqlite3, genutzt von Load-Funktionen und API-Routen.

import { db } from './db';
import type {
  Category,
  CategoryInput,
  Ingredient,
  RecipeInput,
  RecipeListItem,
  RecipeWithDetails,
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

// ---------- Rezepte: Listen ----------

export function listRecipes(opts?: {
  categoryId?: number;
  q?: string;
  limit?: number;
}): RecipeListItem[] {
  const where: string[] = [];
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
  return db
    .prepare(
      `SELECT r.*, c.name AS category_name, c.slug AS category_slug
       FROM recipes r
       LEFT JOIN categories c ON c.id = r.category_id
       ${clause}
       ORDER BY r.created_at DESC
       LIMIT ?`
    )
    .all(...params, limit) as RecipeListItem[];
}

export function searchRecipes(q: string): RecipeListItem[] {
  return listRecipes({ q, limit: 50 });
}

export function countRecipes(): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM recipes').get() as { n: number };
  return row.n;
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
      })
    | undefined;

  if (!recipe) return null;

  const { c_id, c_name, c_slug, c_icon, ...rest } = recipe;
  const ingredients = db
    .prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_order ASC, id ASC')
    .all(id) as Ingredient[];
  const steps = db
    .prepare('SELECT * FROM steps WHERE recipe_id = ? ORDER BY "order" ASC, id ASC')
    .all(id) as Step[];

  return {
    ...(rest as Omit<RecipeWithDetails, 'category' | 'ingredients' | 'steps'>),
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
         (title, description, category_id, base_servings, prep_time_min, cook_time_min, image_url, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.title,
        input.description ?? null,
        resolveCategoryId(input),
        input.base_servings ?? 2,
        input.prep_time_min ?? null,
        input.cook_time_min ?? null,
        input.image_url ?? null,
        input.source ?? null
      );
    const recipeId = Number(info.lastInsertRowid);
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
           prep_time_min = ?, cook_time_min = ?, image_url = ?, source = ?
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
        id
      );
    if (res.changes === 0) return false;
    // Kinder (Schritte/Zutaten) werden vollständig ersetzt (CASCADE löscht mit).
    db.prepare('DELETE FROM steps WHERE recipe_id = ?').run(id);
    // Zutaten ohne Schritt gehören zum Rezept → ebenfalls löschen.
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
