// === Query-Funktionen (server-only) ===
//
// Dünne Schicht über dem mysql2-Pool (aus db.ts), genutzt von Load-
// Funktionen und API-Routen. Alle Funktionen sind async.
//
// Space-Scoping (V10): Jede Funktion erhält die spaceId des aktiven
// Spaces (locals.space.id aus hooks.server.ts) und filtert danach —
// Listen per WHERE space_id = ?, Mutationen/Detail-Abfragen per
// WHERE id = ? AND space_id = ?. Das ist der IDOR-Schutz: IDs anderer
// Spaces liefern schlicht "nicht gefunden" statt fremde Daten.
//
// Row-Mapping: DATETIME-Spalten werden via normalizeDates() zu ISO-
// Strings. is_favorite kommt bereits als echtes Boolean aus MariaDB.

import { pool, normalizeDates, RECIPE_DATES } from './db';
import type { RowDataPacket, ResultSetHeader, PoolConnection, Pool } from 'mysql2/promise';
import type {
  Category,
  CategoryInput,
  CategoryUpdateInput,
  Ingredient,
  KitchenTool,
  PublishedListItem,
  PublishedRecipe,
  RecipeInput,
  RecipeListItem,
  RecipeWithDetails,
  RecipeVersion,
  Step,
  Tag,
  TagWithCount
} from '$lib/types';

// ---------- Kategorien ----------

export async function listCategories(spaceId: number): Promise<Category[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM categories WHERE space_id = ? ORDER BY sort_order ASC, name ASC',
    [spaceId]
  );
  return rows as unknown as Category[];
}

export async function getCategoryBySlug(spaceId: number, slug: string): Promise<Category | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM categories WHERE space_id = ? AND slug = ?',
    [spaceId, slug]
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as Category;
}

export async function createCategory(spaceId: number, input: CategoryInput): Promise<number> {
  // Upsert via eindeutigem (space_id, slug) (MariaDB-Syntax statt SQLite ON CONFLICT).
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO categories (space_id, name, slug, icon, sort_order) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon), sort_order = VALUES(sort_order)`,
    [spaceId, input.name, input.slug, input.icon ?? null, input.sort_order ?? 0]
  );
  return result.insertId;
}

export async function updateCategory(
  spaceId: number,
  id: number,
  input: CategoryUpdateInput
): Promise<boolean> {
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

  params.push(id, spaceId);
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE categories SET ${updates.join(', ')} WHERE id = ? AND space_id = ?`,
    params as never[]
  );
  return result.affectedRows > 0;
}

export async function deleteCategory(spaceId: number, id: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM categories WHERE id = ? AND space_id = ?',
    [id, spaceId]
  );
  return result.affectedRows > 0;
}

// ---------- Küchenutensilien ----------

/** Alle Utensilien des Spaces, alphabetisch (KI-Kontext + Einstellungen). */
export async function listKitchenTools(spaceId: number): Promise<KitchenTool[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name FROM kitchen_tools WHERE space_id = ? ORDER BY name ASC',
    [spaceId]
  );
  return rows as unknown as KitchenTool[];
}

/**
 * Legt ein Utensil im Space an. Duplikate (case-insensitiv, dank Collation)
 * werden stillschweigend aktualisiert → idempotent, kein Fehler.
 */
export async function createKitchenTool(spaceId: number, name: string): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO kitchen_tools (space_id, name) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [spaceId, name]
  );
  return result.insertId;
}

export async function deleteKitchenTool(spaceId: number, id: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM kitchen_tools WHERE id = ? AND space_id = ?',
    [id, spaceId]
  );
  return result.affectedRows > 0;
}

// ---------- Tags ----------

/**
 * Alle Tags des Spaces mit Anzahl passender Rezept-FAMILIEN — Varianten
 * zählen zum Hauptrezept (COALESCE(parent, id)), passend zum Familien-
 * Filter in listRecipes. Für Filter-Popover und Einstellungen.
 */
export async function listTags(spaceId: number): Promise<TagWithCount[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.id, t.name, COUNT(DISTINCT COALESCE(r.parent_recipe_id, r.id)) AS count
     FROM tags t
     LEFT JOIN recipe_tags rt ON rt.tag_id = t.id
     LEFT JOIN recipes r ON r.id = rt.recipe_id
     WHERE t.space_id = ?
     GROUP BY t.id, t.name
     ORDER BY t.name ASC`,
    [spaceId]
  );
  return rows as unknown as TagWithCount[];
}

/** Tag im Space anlegen. Duplikate (case-insensitiv, dank Collation)
 *  werden still aktualisiert → idempotent wie createKitchenTool. */
export async function createTag(spaceId: number, name: string): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO tags (space_id, name) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [spaceId, name]
  );
  if (result.insertId > 0) return result.insertId;
  // Duplikat: insertId ist 0 → vorhandene ID nachschlagen.
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM tags WHERE space_id = ? AND name = ?',
    [spaceId, name]
  );
  return (rows[0] as { id: number }).id;
}

export async function renameTag(spaceId: number, id: number, name: string): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE tags SET name = ? WHERE id = ? AND space_id = ?',
    [name, id, spaceId]
  );
  return result.affectedRows > 0;
}

/** Tag löschen — Verknüpfungen fallen per ON DELETE CASCADE mit weg. */
export async function deleteTag(spaceId: number, id: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM tags WHERE id = ? AND space_id = ?',
    [id, spaceId]
  );
  return result.affectedRows > 0;
}

/** Tag-Namen eines Rezepts (für getRecipe/Edit-Formular).
 *  Nur intern nach erfolgter Space-Prüfung des Rezepts aufrufen. */
export async function getRecipeTags(recipeId: number): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.name FROM tags t
     JOIN recipe_tags rt ON rt.tag_id = t.id
     WHERE rt.recipe_id = ?
     ORDER BY t.name ASC`,
    [recipeId]
  );
  return rows.map((r) => (r as { name: string }).name);
}

/**
 * Normalisiert eine Tag-Liste aus API/KI-Input: trimmen, leere raus,
 * case-insensitiv deduplizieren, auf 40 Zeichen / max. 10 kappen.
 */
export function normalizeTagNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const name = item.trim().slice(0, 40);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Setzt die Tags eines Rezepts vollständig: Get-or-Create je Name im
 * Space, dann Links erneuern (Delete + Insert). Läuft INNERHALB der
 * Transaktion von createRecipe/updateRecipe (conn) — sonst mit pool.
 */
async function syncRecipeTags(
  conn: PoolConnection | Pool,
  spaceId: number,
  recipeId: number,
  names: string[]
): Promise<void> {
  await conn.execute('DELETE FROM recipe_tags WHERE recipe_id = ?', [recipeId]);
  for (const name of names) {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO tags (space_id, name) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [spaceId, name]
    );
    let tagId = result.insertId;
    if (tagId === 0) {
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM tags WHERE space_id = ? AND name = ?',
        [spaceId, name]
      );
      tagId = (rows[0] as { id: number }).id;
    }
    await conn.execute<ResultSetHeader>(
      'INSERT IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)',
      [recipeId, tagId]
    );
  }
}

// ---------- Rezepte: Listen ----------

export async function listRecipes(
  spaceId: number,
  opts?: {
    categoryId?: number;
    q?: string;
    tagIds?: number[];
    limit?: number;
    offset?: number;
  }
): Promise<RecipeListItem[]> {
  const where: string[] = ['r.space_id = ?', 'r.parent_recipe_id IS NULL'];
  const params: unknown[] = [spaceId];
  if (opts?.categoryId != null) {
    where.push('r.category_id = ?');
    params.push(opts.categoryId);
  }
  if (opts?.q) {
    where.push('(r.title LIKE ? OR r.description LIKE ?)');
    params.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  // Tag-Filter mit UND-Semantik über die Rezept-FAMILIE: pro gewähltem
  // Tag muss es IRGENDEINE Version (Hauptrezept oder Variante) mit dem
  // Tag geben — die Liste zeigt weiterhin nur Hauptrezept-Karten.
  for (const tagId of opts?.tagIds ?? []) {
    where.push(`EXISTS (
      SELECT 1 FROM recipe_tags rt
      JOIN recipes f ON f.id = rt.recipe_id
      WHERE rt.tag_id = ? AND (f.id = r.id OR f.parent_recipe_id = r.id)
    )`);
    params.push(tagId);
  }
  const clause = `WHERE ${where.join(' AND ')}`;
  const limit = opts?.limit ?? 200;
  const offset = opts?.offset ?? 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, c.name AS category_name, c.slug AS category_slug
     FROM recipes r
     LEFT JOIN categories c ON c.id = r.category_id
     ${clause}
     ORDER BY r.is_pinned DESC, r.pinned_at DESC, r.is_favorite DESC, r.title ASC, r.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return rows.map((r) => {
    const normalized = normalizeDates(r as unknown as Record<string, unknown>, RECIPE_DATES);
    return {
      ...normalized,
      is_favorite: Boolean(normalized.is_favorite),
      is_pinned: Boolean(normalized.is_pinned),
      is_published: Boolean(normalized.is_published),
      tags: [] as string[] // Listen-Views zeigen keine Tags (nur Detail/Edit)
    } as unknown as RecipeListItem;
  });
}

export async function listFavorites(spaceId: number): Promise<RecipeListItem[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, c.name AS category_name, c.slug AS category_slug
     FROM recipes r
     LEFT JOIN categories c ON c.id = r.category_id
     WHERE r.space_id = ? AND r.is_favorite = 1 AND r.parent_recipe_id IS NULL
     ORDER BY r.is_pinned DESC, r.pinned_at DESC, r.created_at DESC`,
    [spaceId]
  );

  return rows.map((r) => {
    const normalized = normalizeDates(r as unknown as Record<string, unknown>, RECIPE_DATES);
    return {
      ...normalized,
      is_favorite: Boolean(normalized.is_favorite),
      is_pinned: Boolean(normalized.is_pinned),
      is_published: Boolean(normalized.is_published),
      tags: [] as string[] // Listen-Views zeigen keine Tags (nur Detail/Edit)
    } as unknown as RecipeListItem;
  });
}

export async function toggleFavorite(spaceId: number, id: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT is_favorite FROM recipes WHERE id = ? AND space_id = ?',
    [id, spaceId]
  );
  if (rows.length === 0) return false;

  const newFavorite = rows[0].is_favorite ? 0 : 1;
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE recipes SET is_favorite = ? WHERE id = ? AND space_id = ?',
    [newFavorite, id, spaceId]
  );
  return result.affectedRows > 0;
}

/** Pin umschalten: beim Anpinnen pinned_at setzen (zuoberst sortiert), beim Lösen auf NULL. */
export async function togglePin(spaceId: number, id: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT is_pinned FROM recipes WHERE id = ? AND space_id = ?',
    [id, spaceId]
  );
  if (rows.length === 0) return false;

  if (rows[0].is_pinned) {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE recipes SET is_pinned = 0, pinned_at = NULL WHERE id = ? AND space_id = ?',
      [id, spaceId]
    );
    return result.affectedRows > 0;
  }
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE recipes SET is_pinned = 1, pinned_at = NOW() WHERE id = ? AND space_id = ?',
    [id, spaceId]
  );
  return result.affectedRows > 0;
}

// ---------- Rezepte: Versioning ----------

/** Hauptrezept-ID einer Familie im eigenen Space — null, wenn das Rezept
 *  (oder sein Parent) nicht zum Space gehört. */
export async function getMainRecipeId(
  spaceId: number,
  recipeId: number
): Promise<number | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT parent_recipe_id FROM recipes WHERE id = ? AND space_id = ?',
    [recipeId, spaceId]
  );
  if (rows.length === 0) return null;
  const parent = (rows[0] as { parent_recipe_id: number | null }).parent_recipe_id;
  if (parent === null) return recipeId;
  return parent;
}

export async function listRecipeVersions(spaceId: number, parentId: number): Promise<RecipeVersion[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, version_name FROM recipes
     WHERE space_id = ? AND (id = ? OR parent_recipe_id = ?) ORDER BY id ASC`,
    [spaceId, parentId, parentId]
  );

  return (rows as { id: number; version_name: string | null }[]).map((v) => ({
    id: v.id,
    version_name: v.version_name,
    is_main: v.id === parentId
  }));
}

export async function getEffectiveImageUrl(
  spaceId: number,
  recipeId: number
): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT image_url, parent_recipe_id FROM recipes WHERE id = ? AND space_id = ?',
    [recipeId, spaceId]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as { image_url: string | null; parent_recipe_id: number | null };
  if (row.image_url) return row.image_url;
  if (row.parent_recipe_id != null) {
    const [parentRows] = await pool.query<RowDataPacket[]>(
      'SELECT image_url FROM recipes WHERE id = ? AND space_id = ?',
      [row.parent_recipe_id, spaceId]
    );
    if (parentRows.length === 0) return null;
    return (parentRows[0] as { image_url: string | null }).image_url ?? null;
  }
  return null;
}

// ---------- Rezepte: Detail ----------

export async function getRecipe(spaceId: number, id: number): Promise<RecipeWithDetails | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, c.id AS c_id, c.name AS c_name, c.slug AS c_slug, c.icon AS c_icon
     FROM recipes r
     LEFT JOIN categories c ON c.id = r.category_id
     WHERE r.id = ? AND r.space_id = ?`,
    [id, spaceId]
  );
  if (rows.length === 0) return null;

  const recipe = rows[0] as Record<string, unknown> & {
    c_id: number | null;
    c_name: string | null;
    c_slug: string | null;
    c_icon: string | null;
    is_favorite: number | boolean;
    is_pinned: number | boolean;
    is_published: number | boolean;
  };

  const { c_id, c_name, c_slug, c_icon, is_favorite, is_pinned, is_published, ...rest } = recipe;
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
  const tagNames = await getRecipeTags(id);

  return {
    ...(normalizedRest as Omit<RecipeWithDetails, 'category' | 'ingredients' | 'steps' | 'is_favorite' | 'is_pinned' | 'is_published' | 'tags'>),
    is_favorite: Boolean(is_favorite),
    is_pinned: Boolean(is_pinned),
    is_published: Boolean(is_published),
    tags: tagNames,
    category:
      c_id != null
        ? { id: c_id, name: c_name!, slug: c_slug!, icon: c_icon }
        : null,
    ingredients: ingredientRows as unknown as Ingredient[],
    steps: stepRows as unknown as Step[]
  };
}

// ---------- Rezepte: Schreiben ----------

/** Löst die Kategorie des Inputs zu einer ID im SELBEN Space auf.
 *  Direkt übergebene category_ids aus anderen Spaces werden zu null. */
async function resolveCategoryId(spaceId: number, input: RecipeInput): Promise<number | null> {
  if (input.category_id != null) {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM categories WHERE id = ? AND space_id = ?',
      [input.category_id, spaceId]
    );
    if (rows.length === 0) return null;
    return (rows[0] as { id: number }).id;
  }
  if (input.category_slug) {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM categories WHERE slug = ? AND space_id = ?',
      [input.category_slug, spaceId]
    );
    if (rows.length === 0) return null;
    return (rows[0] as { id: number }).id;
  }
  return null;
}

/** Prüft, dass ein Rezept (z. B. als parent_recipe_id angegeben) im
 *  eigenen Space existiert — Varianten dürfen nur innerhalb eines
 *  Spaces hängen. */
export async function recipeExistsInSpace(
  spaceId: number,
  recipeId: number
): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM recipes WHERE id = ? AND space_id = ?',
    [recipeId, spaceId]
  );
  return rows.length > 0;
}

export async function createRecipe(
  spaceId: number,
  input: RecipeInput,
  createdBy: number | null
): Promise<number> {
  // Transaktion: Rezept + Steps + Ingredients atomar anlegen.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO recipes
       (space_id, title, description, category_id, base_servings, prep_time_min, cook_time_min, image_url, source, parent_recipe_id, version_name, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        spaceId,
        input.title,
        input.description ?? null,
        await resolveCategoryId(spaceId, input),
        input.base_servings ?? 4,
        input.prep_time_min ?? null,
        input.cook_time_min ?? null,
        input.image_url ?? null,
        input.source ?? null,
        input.parent_recipe_id ?? null,
        input.version_name ?? null,
        createdBy
      ]
    );
    const recipeId = result.insertId;

    // Bild vom Parent erben, falls keins gesetzt und parent existiert
    // (Parent-Validierung macht die aufrufende Route — hier zusätzlich
    // space-gebunden, damit kein fremdes Bild durchrutscht).
    if (input.parent_recipe_id && !input.image_url) {
      const [parentRows] = await conn.query<RowDataPacket[]>(
        'SELECT image_url FROM recipes WHERE id = ? AND space_id = ?',
        [input.parent_recipe_id, spaceId]
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
    await syncRecipeTags(conn, spaceId, recipeId, input.tags ?? []);
    await conn.commit();
    return recipeId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateRecipe(
  spaceId: number,
  id: number,
  input: RecipeInput
): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<ResultSetHeader>(
      `UPDATE recipes SET
         title = ?, description = ?, category_id = ?, base_servings = ?,
         prep_time_min = ?, cook_time_min = ?, image_url = ?, source = ?, version_name = ?
       WHERE id = ? AND space_id = ?`,
      [
        input.title,
        input.description ?? null,
        await resolveCategoryId(spaceId, input),
        input.base_servings ?? 4,
        input.prep_time_min ?? null,
        input.cook_time_min ?? null,
        input.image_url ?? null,
        input.source ?? null,
        input.version_name ?? null,
        id,
        spaceId
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
    await syncRecipeTags(conn, spaceId, id, input.tags ?? []);
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteRecipe(spaceId: number, id: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM recipes WHERE id = ? AND space_id = ?',
    [id, spaceId]
  );
  return result.affectedRows > 0;
}

/**
 * Löscht die ganze Rezept-FAMILIE: Hauptrezept plus aller Varianten
 * (egal welche Familien-ID übergeben wird — Haupt- oder Varianten-ID).
 * Wichtig: zwei getrennte Statements (erst Varianten, dann Hauptrezept) —
 * ein combined DELETE (id = ? OR parent_recipe_id = ?) scheitert am
 * selbst-referenzierenden FK mit „Can't find record" (InnoDB 1032).
 */
export async function deleteRecipeFamily(spaceId: number, recipeId: number): Promise<boolean> {
  const mainId = await getMainRecipeId(spaceId, recipeId);
  if (!mainId) return false;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM recipes WHERE parent_recipe_id = ? AND space_id = ?', [
      mainId,
      spaceId
    ]);
    const [result] = await conn.execute<ResultSetHeader>(
      'DELETE FROM recipes WHERE id = ? AND space_id = ?',
      [mainId, spaceId]
    );
    await conn.commit();
    return result.affectedRows > 0;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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

export async function getRecipeImageUrl(
  spaceId: number,
  id: number
): Promise<{ id: number; image_url: string | null } | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, image_url FROM recipes WHERE id = ? AND space_id = ?',
    [id, spaceId]
  );
  if (rows.length === 0) return null;
  return rows[0] as unknown as { id: number; image_url: string | null };
}

export async function setRecipeImageUrl(
  spaceId: number,
  id: number,
  imageUrl: string
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE recipes SET image_url = ? WHERE id = ? AND space_id = ?',
    [imageUrl, id, spaceId]
  );
  return result.affectedRows > 0;
}

// ---------- Bild-Zugriff (für /images/[file]) ----------

/**
 * Prüft, ob ein Rezept-Bild für den Benutzer sichtbar ist: Mitglied des
 * Spaces ODER Rezept veröffentlicht (Phase 3 „Öffentlich"). filePath ist
 * der URL-Teil nach /images/ (z. B. "recipe-12-1730000000000.jpg").
 * Gibt false zurück, wenn der Dateiname keinem Rezept zuzuordnen ist.
 */
export async function canViewRecipeImage(
  userId: number,
  filePath: string
): Promise<boolean> {
  const match = filePath.match(/^recipe-(\d+)-/);
  if (!match) return false;
  const recipeId = Number(match[1]);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.is_published,
            EXISTS (
              SELECT 1 FROM space_members sm
              WHERE sm.space_id = r.space_id AND sm.user_id = ?
            ) AS is_member
     FROM recipes r WHERE r.id = ?`,
    [userId, recipeId]
  );
  if (rows.length === 0) return false;
  const row = rows[0] as { is_published: number | boolean; is_member: number | boolean };
  return Boolean(row.is_published) || Boolean(row.is_member);
}

// ---------- Öffentlicher Bereich (Phase 3 „Öffentlich") ----------
// Veröffentlichte Rezepte sind für ALLE eingeloggten Benutzer sichtbar
// (über Spaces hinweg). Attribution: Rezept aus einem persönlichen Space
// (1 Mitglied) → Vorname des Urhebers; aus einem geteilten Space
// (z. B. „Familie") → Space-Name. Das Publish-Flag selbst wird
// space-scoped gesetzt (nur eigene Rezepte).

/** Anzeigename eines Urhebers als VORNAME: erstes Wort von
 *  name || username || email (bei E-Mail-Adressen der Teil vor dem @). */
function authorDisplayName(row: {
  name: string | null;
  username: string | null;
  email: string | null;
}): string | null {
  const full = (row.name ?? row.username ?? row.email)?.trim();
  if (!full) return null;
  const first = full.split(/\s+/)[0];
  return first.includes('@') ? first.split('@')[0] : first;
}

/** SQL-Schnipsel + Mapper für veröffentlichte Rezepte mit Attribution. */
const PUBLISHED_SELECT = `
  SELECT r.*, c.id AS c_id, c.name AS category_name, c.slug AS category_slug,
         c.icon AS c_icon, u.name AS u_name, u.username AS u_username,
         u.email AS u_email, s.name AS space_name, smc.member_count,
         su.name AS su_name, su.username AS su_username, su.email AS su_email
  FROM recipes r
  LEFT JOIN categories c ON c.id = r.category_id
  LEFT JOIN users u ON u.id = r.created_by
  JOIN spaces s ON s.id = r.space_id
  LEFT JOIN (
    SELECT sm.space_id, COUNT(*) AS member_count, MIN(sm.user_id) AS first_user_id
    FROM space_members sm
    GROUP BY sm.space_id
  ) smc ON smc.space_id = r.space_id
  LEFT JOIN users su ON su.id = smc.first_user_id`;

interface PublishedRow extends Record<string, unknown> {
  u_name: string | null;
  u_username: string | null;
  u_email: string | null;
  space_name: string | null;
  member_count: number;
  su_name: string | null;
  su_username: string | null;
  su_email: string | null;
}

/**
 * Anzeige der Urheberschaft: geteilter Space (mehrere Mitglieder, z. B.
 * „Familie") → Space-Name; persönlicher Space (ein Mitglied) → Vorname
 * des Urhebers — und falls created_by fehlt (Alt-Rezepte), Vorname des
 * einzigen Mitglieds (das muss der Urheber sein).
 */
function attributionLabel(row: PublishedRow): string | null {
  if (Number(row.member_count ?? 0) > 1) return row.space_name ?? null;
  return authorDisplayName({
    name: row.u_name ?? row.su_name,
    username: row.u_username ?? row.su_username,
    email: row.u_email ?? row.su_email
  });
}

function mapPublishedRow(row: PublishedRow): PublishedListItem {
  const normalized = normalizeDates(row, RECIPE_DATES);
  return {
    ...normalized,
    // Pin/Favorit sind private Space-Zustände des Urhebers — im
    // schreibgeschützten öffentlichen Bereich immer aus.
    is_favorite: false,
    is_pinned: false,
    is_published: Boolean(normalized.is_published),
    author_label: attributionLabel(row),
    tags: [] as string[]
  } as unknown as PublishedListItem;
}

/**
 * Alle veröffentlichten Rezepte (aller Spaces), neueste zuerst.
 * Filter (kombinierbar): q = Titel/Beschreibung, tagNames = UND-Verknüpft
 * direkt am Rezept (die öffentliche Liste ist flach — kein Familien-
 * Konzept wie bei listRecipes), categoryName = exakter Kategoriename.
 * Tags/Kategorien werden absichtlich über den NAMEN gefiltert (nicht die
 * id): beide sind space-scoped, gleiche Begriffe aus verschiedenen
 * Spaces sollen gemeinsam treffen.
 */
export async function listPublishedRecipes(opts: {
  q?: string;
  tagNames?: string[];
  categoryName?: string;
} = {}): Promise<PublishedListItem[]> {
  const params: unknown[] = [];
  let where = 'WHERE r.is_published = 1';
  if (opts.q) {
    where += ' AND (r.title LIKE ? OR r.description LIKE ?)';
    params.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  for (const tagName of opts.tagNames ?? []) {
    where += ` AND EXISTS (
      SELECT 1 FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id
      WHERE rt.recipe_id = r.id AND t.name = ?
    )`;
    params.push(tagName);
  }
  if (opts.categoryName) {
    where += ' AND c.name = ?';
    params.push(opts.categoryName);
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `${PUBLISHED_SELECT}
     ${where}
     ORDER BY r.published_at DESC, r.id DESC
     LIMIT 200`,
    params
  );
  return rows.map((r) => mapPublishedRow(r as unknown as PublishedRow));
}

/** Option für einen Filter im öffentlichen Bereich (Name + Trefferzahl). */
export interface PublishedFilterOption {
  name: string;
  count: number;
}

/** Tag-Namen veröffentlichter Rezepte mit Zählern — Optionen für den
 *  Tag-Filter im öffentlichen Bereich. Gruppiert nach NAME, da Tags
 *  space-scoped sind und gleiche Begriffe aus verschiedenen Spaces
 *  zusammengehören. */
export async function listPublishedTags(): Promise<PublishedFilterOption[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.name, COUNT(*) AS count
     FROM recipes r
     JOIN recipe_tags rt ON rt.recipe_id = r.id
     JOIN tags t ON t.id = rt.tag_id
     WHERE r.is_published = 1
     GROUP BY t.name
     ORDER BY t.name ASC`
  );
  return rows.map((r) => ({ name: r.name as string, count: Number(r.count) }));
}

/** Kategorienamen veröffentlichter Rezepte mit Zählern — Optionen für
 *  den Kategorie-Filter im öffentlichen Bereich (nach NAME gruppiert). */
export async function listPublishedCategories(): Promise<PublishedFilterOption[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.name, COUNT(*) AS count
     FROM recipes r
     JOIN categories c ON c.id = r.category_id
     WHERE r.is_published = 1
     GROUP BY c.name
     ORDER BY c.name ASC`
  );
  return rows.map((r) => ({ name: r.name as string, count: Number(r.count) }));
}

/**
 * Veröffentlichtes Rezept mit Steps/Zutaten/Tags + Attribution — oder
 * null (nicht gefunden ODER nicht veröffentlicht).
 */
export async function getPublishedRecipe(id: number): Promise<PublishedRecipe | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${PUBLISHED_SELECT}
     WHERE r.id = ? AND r.is_published = 1`,
    [id]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as unknown as PublishedRow & {
    c_id: number | null;
    category_name: string | null;
    category_slug: string | null;
    c_icon: string | null;
  };

  const [ingredientRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_order ASC, id ASC',
    [id]
  );
  const [stepRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM steps WHERE recipe_id = ? ORDER BY `order` ASC, id ASC',
    [id]
  );
  const tagNames = await getRecipeTags(id);

  const {
    u_name, u_username, u_email,
    su_name, su_username, su_email,
    space_name, member_count,
    ...rest
  } = row;
  const normalized = normalizeDates(rest, RECIPE_DATES);
  return {
    ...(normalized as object),
    // Pin/Favorit sind private Space-Zustände des Urhebers — im
    // schreibgeschützten öffentlichen Bereich immer aus.
    is_favorite: false,
    is_pinned: false,
    is_published: true,
    author_label: attributionLabel({
      u_name, u_username, u_email,
      su_name, su_username, su_email,
      space_name, member_count
    }),
    tags: tagNames,
    category:
      row.c_id != null
        ? { id: row.c_id, name: row.category_name!, slug: row.category_slug!, icon: row.c_icon }
        : null,
    ingredients: ingredientRows as unknown as Ingredient[],
    steps: stepRows as unknown as Step[]
  } as unknown as PublishedRecipe;
}

/** Veröffentlichte Versionen einer Rezept-Familie für die öffentliche
 *  Detailseite: Hauptrezept + Varianten, aber NUR Familien-Mitglieder
 *  mit is_published = 1 — unveröffentlichte Varianten bleiben privat
 *  (und würden beim Umschalten sonst 404 liefern). `recipeId` darf die
 *  Haupt- ODER eine Varianten-ID sein; die Familie wird über
 *  parent_recipe_id aufgelöst. */
export async function getPublishedVersions(recipeId: number): Promise<RecipeVersion[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT fam.id, fam.version_name,
            COALESCE(r.parent_recipe_id, r.id) AS main_id
     FROM recipes fam
     JOIN recipes r ON r.id = ?
     WHERE fam.is_published = 1
       AND (fam.id = COALESCE(r.parent_recipe_id, r.id)
            OR fam.parent_recipe_id = COALESCE(r.parent_recipe_id, r.id))
     ORDER BY fam.id ASC`,
    [recipeId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    version_name: (row.version_name as string | null) ?? null,
    is_main: Number(row.id) === Number(row.main_id)
  }));
}

/** Veröffentlichen/Zurückziehen — nur im eigenen Space (IDOR-Schutz). */
export async function togglePublish(spaceId: number, id: number): Promise<boolean | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT is_published FROM recipes WHERE id = ? AND space_id = ?',
    [id, spaceId]
  );
  if (rows.length === 0) return null;

  if (rows[0].is_published) {
    await pool.execute(
      'UPDATE recipes SET is_published = 0, published_at = NULL WHERE id = ? AND space_id = ?',
      [id, spaceId]
    );
    return false;
  }
  await pool.execute(
    'UPDATE recipes SET is_published = 1, published_at = NOW() WHERE id = ? AND space_id = ?',
    [id, spaceId]
  );
  return true;
}

/**
 * Kopiert ein (vom Aufrufer auf Sichtbarkeit geprüftes) Rezept als neue,
 * unveröffentlichte Hauptversion in den Ziel-Space: Schritte, Zutaten und
 * Tags vollständig (Tags per Get-or-Create im Ziel-Space). Die Kategorie
 * wird über den slug abgebildet — existiert sie im Ziel-Space nicht, bleibt
 * das Rezept uncategorized. Das Bild verweist zunächst auf dieselbe Datei;
 * die aufrufende Route dupliziert die Datei (sonst bricht die Kopie, wenn
 * das Original gelöscht wird).
 */
export async function copyRecipeIntoSpace(
  targetSpaceId: number,
  source: RecipeWithDetails,
  copiedBy: number | null
): Promise<number> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Kategorie nach slug im Ziel-Space suchen (Categories sind pro Space).
    let categoryId: number | null = null;
    if (source.category) {
      const [catRows] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM categories WHERE space_id = ? AND slug = ?',
        [targetSpaceId, source.category.slug]
      );
      if (catRows.length > 0) categoryId = (catRows[0] as { id: number }).id;
    }

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO recipes
       (space_id, title, description, category_id, base_servings, prep_time_min,
        cook_time_min, image_url, source, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetSpaceId,
        source.title,
        source.description ?? null,
        categoryId,
        source.base_servings,
        source.prep_time_min ?? null,
        source.cook_time_min ?? null,
        source.image_url ?? null,
        source.source ?? null,
        copiedBy
      ]
    );
    const newId = result.insertId;

    // Steps kopieren und alte step_id → neue mappen (Zutaten hängen dran).
    const stepIdMap = new Map<number, number>();
    const sortedSteps = [...source.steps].sort((a, b) => a.order - b.order);
    for (const s of sortedSteps) {
      const [stepRes] = await conn.execute<ResultSetHeader>(
        'INSERT INTO steps (recipe_id, `order`, instruction, duration_sec) VALUES (?, ?, ?, ?)',
        [newId, s.order, s.instruction, s.duration_sec ?? null]
      );
      stepIdMap.set(s.id, stepRes.insertId);
    }
    for (const ing of source.ingredients) {
      await conn.execute<ResultSetHeader>(
        `INSERT INTO ingredients (recipe_id, step_id, name, quantity, unit, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          newId,
          ing.step_id != null ? stepIdMap.get(ing.step_id) ?? null : null,
          ing.name,
          ing.quantity ?? null,
          ing.unit ?? null,
          ing.sort_order
        ]
      );
    }

    await syncRecipeTags(conn, targetSpaceId, newId, source.tags);
    await conn.commit();
    return newId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
