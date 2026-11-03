import type { PageServerLoad } from './$types';
import { requireSpaceId } from '$lib/server/spaces';
import {
  getApiKey,
  getBaseUrl,
  getModel,
  maskKey,
  DEFAULT_MODEL,
  DEFAULT_BASE_URL
} from '$lib/server/settings';

// Lädt den KI-Konfigurations-Status des aktiven Spaces. Der API-Key
// wird **maskiert** zurückgegeben, nie im Klartext.
export const load: PageServerLoad = async ({ locals }) => {
  const spaceId = requireSpaceId(locals);
  const apiKey = await getApiKey(spaceId);
  const model = await getModel(spaceId);
  const baseURL = await getBaseUrl(spaceId);
  return {
    has_key: apiKey !== null && apiKey.trim() !== '',
    key_hint: apiKey ? maskKey(apiKey) : '',
    ai_model: model,
    ai_base_url: baseURL,
    default_model: DEFAULT_MODEL,
    default_base_url: DEFAULT_BASE_URL
  };
};
