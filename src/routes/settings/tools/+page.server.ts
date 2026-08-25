import type { PageServerLoad } from './$types';
import { listKitchenTools } from '$lib/server/queries';

// Lädt die gespeicherten Küchenutensilien für die Verwaltungs-UI.
export const load: PageServerLoad = async () => {
  const tools = await listKitchenTools();
  return { tools };
};
