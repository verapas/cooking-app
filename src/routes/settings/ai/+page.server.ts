import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getApiKey,
  getBaseUrl,
  getModel,
  maskKey,
  DEFAULT_MODEL,
  DEFAULT_BASE_URL
} from '$lib/server/settings';

// Lädt den KI-Konfigurations-Status des BENUTZERS (KI-Settings sind
// nutzerspezifisch, V12). Der API-Key wird **maskiert** zurückgegeben,
// nie im Klartext.
export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, 'Nicht angemeldet');
  const apiKey = await getApiKey(userId);
  const model = await getModel(userId);
  const baseURL = await getBaseUrl(userId);
  return {
    has_key: apiKey !== null && apiKey.trim() !== '',
    key_hint: apiKey ? maskKey(apiKey) : '',
    ai_model: model,
    ai_base_url: baseURL,
    default_model: DEFAULT_MODEL,
    default_base_url: DEFAULT_BASE_URL
  };
};
