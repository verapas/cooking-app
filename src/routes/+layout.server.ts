import { listCategories } from '$lib/server/queries';
import type { LayoutServerLoad } from './$types';

// Kategorien zentral laden – stehen allen Seiten via `data.categories`
// zur Verfügung (v. a. dem Drawer). Seiten müssen sie nicht selbst laden.
export const load: LayoutServerLoad = async () => {
  return { categories: await listCategories() };
};
