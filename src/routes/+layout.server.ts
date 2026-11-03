import { listCategories } from '$lib/server/queries';
import type { LayoutServerLoad } from './$types';

// Kategorien zentral laden – stehen allen Seiten via `data.categories`
// zur Verfügung (v. a. dem Drawer). Seiten müssen sie nicht selbst laden.
// `user`/`space` kommen aus dem Session-Guard (hooks.server.ts) → NavDrawer.
export const load: LayoutServerLoad = async ({ locals }) => {
  // Öffentliche Pfade ohne Login (z. B. /offline) haben keinen Space —
  // der Layout-Load läuft für ALLE Seiten, auch öffentliche.
  if (!locals.space) {
    return { categories: [], user: locals.user, space: null };
  }
  return {
    categories: await listCategories(locals.space.id),
    user: locals.user,
    space: locals.space
  };
};
