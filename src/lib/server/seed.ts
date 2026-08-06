// === Kategorien-Seeder (server-only) ===
//
// Legt beim ersten Start die Standard-Kategorien an, damit die App nicht
// ohne Kategorien startet. Idempotent: läuft nur, wenn noch keine
// Kategorie existiert. Demo-Rezepte und Auth-Seeder gibt es nicht mehr.

import { listCategories, createCategory } from './queries';
import type { CategoryInput } from '$lib/types';

const CATEGORIES: CategoryInput[] = [
  { name: 'Suppen', slug: 'suppen', icon: 'soup', sort_order: 1 },
  { name: 'Salate', slug: 'salate', icon: 'salad', sort_order: 2 },
  { name: 'Brot & Backwerk', slug: 'brot-backwerk', icon: 'bread', sort_order: 3 },
  { name: 'Pasta', slug: 'pasta', icon: 'pasta', sort_order: 4 },
  { name: 'Hauptgerichte', slug: 'hauptgerichte', icon: 'plate', sort_order: 5 },
  { name: 'Desserts', slug: 'desserts', icon: 'cake', sort_order: 6 },
  { name: 'Snacks', slug: 'snacks', icon: 'snack', sort_order: 7 }
];

/**
 * Legt die Standard-Kategorien an, falls noch keine existieren.
 * Idempotent — sicher, mehrfach aufgerufen zu werden.
 */
export async function seedCategoriesIfEmpty(): Promise<void> {
  const existing = await listCategories();
  if (existing.length > 0) return;
  for (const c of CATEGORIES) {
    await createCategory(c);
  }
}
