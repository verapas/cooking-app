import { listCategories } from '$lib/server/queries';
import type { LayoutServerLoad } from './$types';

// Kategorien zentral laden – stehen allen Seiten via `data.categories`
// zur Verfügung (v. a. dem Drawer). Seiten müssen sie nicht selbst laden.
// `user` kommt aus dem Session-Guard (hooks.server.ts) → NavDrawer.
export const load: LayoutServerLoad = async ({ locals }) => {
  return { categories: await listCategories(), user: locals.user };
};
