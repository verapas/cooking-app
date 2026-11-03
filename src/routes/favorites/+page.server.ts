import { listFavorites } from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';

export async function load({ locals }: { locals: App.Locals }) {
  return {
    recipes: await listFavorites(requireSpaceId(locals))
  };
}
