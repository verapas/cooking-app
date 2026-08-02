import { listFavorites } from '$lib/server/queries';

export async function load() {
  return {
    recipes: await listFavorites()
  };
}