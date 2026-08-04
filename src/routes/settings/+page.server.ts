import type { PageServerLoad } from './$types';
import { getApiKey, getBaseUrl, getModel, maskKey, DEFAULT_MODEL, DEFAULT_BASE_URL } from '$lib/server/settings';

// Lädt den KI-Konfigurations-Status. Der API-Key wird **maskiert**
// zurückgegeben, nie im Klartext.
export const load: PageServerLoad = async () => {
  const apiKey = await getApiKey();
  const model = await getModel();
  const baseURL = await getBaseUrl();
  return {
    has_key: apiKey !== null && apiKey.trim() !== '',
    key_hint: apiKey ? maskKey(apiKey) : '',
    ai_model: model,
    ai_base_url: baseURL,
    default_model: DEFAULT_MODEL,
    default_base_url: DEFAULT_BASE_URL
  };
};
