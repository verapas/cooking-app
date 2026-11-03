import type { PageServerLoad } from './$types';
import { requireSpaceId } from '$lib/server/spaces';
import { listKitchenTools } from '$lib/server/queries';

// Lädt die gespeicherten Küchenutensilien des aktiven Spaces für die
// Verwaltungs-UI.
export const load: PageServerLoad = async ({ locals }) => {
  const tools = await listKitchenTools(requireSpaceId(locals));
  return { tools };
};
