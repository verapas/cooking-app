// === Query-Funktionen (server-only) ===
//
// Dünne Schicht über dem mysql2-Pool (aus db.ts), genutzt von Load-
// Funktionen und API-Routen. Alle Funktionen sind async.
//
// Row-Mapping: DATETIME-Spalten werden via normalizeDates() zu ISO-
// Strings. is_favorite kommt bereits als echtes Boolean aus MariaDB.

import { pool, normalizeDates, RECIPE_DATES } from './db';
import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import type {
  Category,
  CategoryInput,
  CategoryUpdateInput,
  Ingredient,
  KitchenTool,
  RecipeInput,
  RecipeListItem,
  RecipeWithDetails,
  RecipeVersion,
  Step
} from '$lib/types';

// ---------- Kategorien ----------

export async function listCategories(): Promise<Category[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM categories ORDER BY sort_order ASC, name ASC'
  );
  return rows as unknown as Category[];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM categories WHERE slug = ?',
    [slug]
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as Category;
}

export async function createCategory(input: CategoryInput): Promise<number> {
  // Upsert via eindeutigem slug (MariaDB-Syntax statt SQLite ON CONFLICT).
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO categories (name, slug, icon, sort_order) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon), sort_order = VALUES(sort_order)`,
    [input.name, input.slug, input.icon ?? null, input.sort_order ?? 0]
  );
  return result.insertId;
}

export async function updateCategory(id: number, input: CategoryUpdateInput): Promise<boolean> {
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
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
    params as never[]
  );
  return result.affectedRows > 0;
}

export async function deleteCategory(id: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM categories WHERE id = ?',
    [id]
  );
  return result.affectedRows > 0;
}

// ---------- Küchenutensilien ----------

/** Alle Utensilien der Person, alphabetisch (KI-Kontext + Einstellungen). */
export async function listKitchenTools(): Promise<KitchenTool[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name FROM kitchen_tools ORDER BY name ASC'
  );
  return rows as unknown as KitchenTool[];
}

/**
 * Legt ein Utensil an. Duplikate (case-insensitiv, dank Collation)
 * werden stillschweigend aktualisiert → idempotent, kein Fehler.
 */
export async function createKitchenTool(name: string): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO kitchen_tools (name) VALUES (?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [name]
  );
  return result.insertId;
}

export async function deleteKitchenTool(id: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM kitchen_tools WHERE id = ?',
    [id]
  );
  return result.affectedRows > 0;
}

// ---------- Rezepte: Listen ----------

export async function listRecipes(opts?: {
  categoryId?: number;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<RecipeListItem[]> {
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
  const clause = `WHERE ${where.join(' AND ')}`;
  const limit = opts?.limit ?? 200;
  const offset = opts?.offset ?? 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, c.name AS category_name, c.slug AS category_slug
     FROM recipes r
     LEFT JOIN categories c ON c.id = r.category_id
     ${clause}
     ORDER BY r.is_favorite DESC, r.title ASC, r.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return rows.map((r) => {
    const normalized = normalizeDates(r as unknown as Record<string, unknown>, RECIPE_DATES);
    return {
      ...normalized,
      is_favorite: Boolean(normalized.is_favorite)
    } as unknown as RecipeListItem;
  });
}

export async function listFavorites(): Promise<RecipeListItem[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, c.name AS category_name, c.slug AS category_slug
     FROM recipes r
     LEFT JOIN categories c ON c.id = r.category_id
     WHERE r.is_favorite = 1 AND r.parent_recipe_id IS NULL
     ORDER BY r.created_at DESC`
  );

  return rows.map((r) => {
    const normalized = normalizeDates(r as unknown as Record<string, unknown>, RECIPE_DATES);
    return {
      ...normalized,
      is_favorite: Boolean(normalized.is_favorite)
    } as unknown as RecipeListItem;
  });
}

export async function toggleFavorite(id: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT is_favorite FROM recipes WHERE id = ?',
    [id]
  );
  if (rows.length === 0) return false;

  const newFavorite = rows[0].is_favorite ? 0 : 1;
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE recipes SET is_favorite = ? WHERE id = ?',
    [newFavorite, id]
  );
  return result.affectedRows > 0;
}

export async function countRecipes(): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS n FROM recipes WHERE parent_recipe_id IS NULL'
  );
  return Number((rows[0] as { n: number }).n);
}

// ---------- Rezepte: Versioning ----------

export async function getMainRecipeId(recipeId: number): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT parent_recipe_id FROM recipes WHERE id = ?',
    [recipeId]
  );
  if (rows.length === 0) return null;
  const parent = (rows[0] as { parent_recipe_id: number | null }).parent_recipe_id;
  if (parent === null) return recipeId;
  return parent;
}

export async function listRecipeVersions(parentId: number): Promise<RecipeVersion[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, version_name FROM recipes WHERE id = ? OR parent_recipe_id = ? ORDER BY id ASC`,
    [parentId, parentId]
  );

  return (rows as { id: number; version_name: string | null }[]).map((v) => ({
    id: v.id,
    version_name: v.version_name,
    is_main: v.id === parentId
  }));
}

export async function getRecipeWithVersion(
  recipeId: number,
  versionId: number
): Promise<RecipeWithDetails | null> {
  return getRecipe(versionId);
}

export async function getEffectiveImageUrl(recipeId: number): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT image_url, parent_recipe_id FROM recipes WHERE id = ?',
    [recipeId]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as { image_url: string | null; parent_recipe_id: number | null };
  if (row.image_url) return row.image_url;
  if (row.parent_recipe_id != null) {
    const [parentRows] = await pool.query<RowDataPacket[]>(
      'SELECT image_url FROM recipes WHERE id = ?',
      [row.parent_recipe_id]
    );
    if (parentRows.length === 0) return null;
    return (parentRows[0] as { image_url: string | null }).image_url ?? null;
  }
  return null;
}

// ---------- Rezepte: Detail ----------

export async function getRecipe(id: number): Promise<RecipeWithDetails | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, c.id AS c_id, c.name AS c_name, c.slug AS c_slug, c.icon AS c_icon
     FROM recipes r
     LEFT JOIN categories c ON c.id = r.category_id
     WHERE r.id = ?`,
    [id]
  );
  if (rows.length === 0) return null;

  const recipe = rows[0] as Record<string, unknown> & {
    c_id: number | null;
    c_name: string | null;
    c_slug: string | null;
    c_icon: string | null;
    is_favorite: number | boolean;
  };

  const { c_id, c_name, c_slug, c_icon, is_favorite, ...rest } = recipe;
  const normalizedRest = normalizeDates(rest as Record<string, unknown>, RECIPE_DATES);

  const [ingredientRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_order ASC, id ASC',
    [id]
  );
  const [stepRows] = await pool.query<RowDataPacket[]>(
    // "order" ist reserviert → backticked
    'SELECT * FROM steps WHERE recipe_id = ? ORDER BY `order` ASC, id ASC',
    [id]
  );

  return {
    ...(normalizedRest as Omit<RecipeWithDetails, 'category' | 'ingredients' | 'steps' | 'is_favorite'>),
    is_favorite: Boolean(is_favorite),
    category:
      c_id != null
        ? { id: c_id, name: c_name!, slug: c_slug!, icon: c_icon }
        : null,
    ingredients: ingredientRows as unknown as Ingredient[],
    steps: stepRows as unknown as Step[]
  };
}

// ---------- Rezepte: Schreiben ----------

async function resolveCategoryId(input: RecipeInput): Promise<number | null> {
  if (input.category_id != null) return input.category_id;
  if (input.category_slug) {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM categories WHERE slug = ?',
      [input.category_slug]
    );
    if (rows.length === 0) return null;
    return (rows[0] as { id: number }).id;
  }
  return null;
}

export async function createRecipe(input: RecipeInput): Promise<number> {
  // Transaktion: Rezept + Steps + Ingredients atomar anlegen.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO recipes
       (title, description, category_id, base_servings, prep_time_min, cook_time_min, image_url, source, parent_recipe_id, version_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.title,
        input.description ?? null,
        await resolveCategoryId(input),
        input.base_servings ?? 4,
        input.prep_time_min ?? null,
        input.cook_time_min ?? null,
        input.image_url ?? null,
        input.source ?? null,
        input.parent_recipe_id ?? null,
        input.version_name ?? null
      ]
    );
    const recipeId = result.insertId;

    // Bild vom Parent erben, falls keins gesetzt und parent existiert.
    if (input.parent_recipe_id && !input.image_url) {
      const [parentRows] = await conn.query<RowDataPacket[]>(
        'SELECT image_url FROM recipes WHERE id = ?',
        [input.parent_recipe_id]
      );
      if (parentRows.length > 0) {
        const parentImage = (parentRows[0] as { image_url: string | null }).image_url;
        if (parentImage) {
          await conn.execute<ResultSetHeader>(
            'UPDATE recipes SET image_url = ? WHERE id = ?',
            [parentImage, recipeId]
          );
        }
      }
    }

    await insertChildren(conn, recipeId, input);
    await conn.commit();
    return recipeId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateRecipe(id: number, input: RecipeInput): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<ResultSetHeader>(
      `UPDATE recipes SET
         title = ?, description = ?, category_id = ?, base_servings = ?,
         prep_time_min = ?, cook_time_min = ?, image_url = ?, source = ?, version_name = ?
       WHERE id = ?`,
      [
        input.title,
        input.description ?? null,
        await resolveCategoryId(input),
        input.base_servings ?? 4,
        input.prep_time_min ?? null,
        input.cook_time_min ?? null,
        input.image_url ?? null,
        input.source ?? null,
        input.version_name ?? null,
        id
      ]
    );
    if (result.affectedRows === 0) {
      await conn.commit();
      return false;
    }

    // Delete-all-reinsert: Steps und Ingredients gehören vollständig zum
    // Rezept und werden bei jedem Edit komplett erneuert.
    await conn.execute('DELETE FROM steps WHERE recipe_id = ?', [id]);
    await conn.execute('DELETE FROM ingredients WHERE recipe_id = ?', [id]);
    await insertChildren(conn, id, input);
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteRecipe(id: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM recipes WHERE id = ?',
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Legt Schritte + Zutaten für ein bestehendes Rezept an.
 * Läuft innerhalb der übergebenen Transaktion (conn), damit createRecipe/
 * updateRecipe atomar bleiben.
 */
async function insertChildren(conn: PoolConnection, recipeId: number, input: RecipeInput): Promise<void> {
  const orderToStepId = new Map<number, number>();
  const steps = [...(input.steps ?? [])].sort((a, b) => a.order - b.order);
  for (const s of steps) {
    const [info] = await conn.execute<ResultSetHeader>(
      `INSERT INTO steps (recipe_id, \`order\`, instruction, duration_sec) VALUES (?, ?, ?, ?)`,
      [recipeId, s.order, s.instruction, s.duration_sec ?? null]
    );
    orderToStepId.set(s.order, info.insertId);
  }

  const ings = input.ingredients ?? [];
  for (let i = 0; i < ings.length; i++) {
    const ing = ings[i];
    const stepId = ing.step_order != null ? orderToStepId.get(ing.step_order) ?? null : null;
    await conn.execute<ResultSetHeader>(
      `INSERT INTO ingredients (recipe_id, step_id, name, quantity, unit, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [recipeId, stepId, ing.name, ing.quantity ?? null, ing.unit ?? null, ing.sort_order ?? i]
    );
  }
}

// ---------- Bild-URL (für den Upload-Endpunkt) ----------
// Bislang rohes SQL im +server.ts; hier zentralisiert, damit das
// rohe-SQL-Problem nur noch an einer Stelle existiert.

export async function getRecipeImageUrl(id: number): Promise<{ id: number; image_url: string | null } | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, image_url FROM recipes WHERE id = ?',
    [id]
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as { id: number; image_url: string | null };
}

export async function setRecipeImageUrl(id: number, imageUrl: string): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE recipes SET image_url = ? WHERE id = ?',
    [imageUrl, id]
  );
  return result.affectedRows > 0;
}

// Hilfsfunktion für seed.ts: Rezept anhand des Titels finden (Parent-Lookup).
export async function getRecipeIdByTitle(title: string): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM recipes WHERE title = ? AND parent_recipe_id IS NULL LIMIT 1',
    [title]
  );
  if (rows.length === 0) return null;
  return (rows[0] as { id: number }).id;
}
