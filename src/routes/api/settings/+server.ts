import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getApiKey,
  getBaseUrl,
  getModel,
  maskKey,
  setSetting,
  SETTINGS,
  DEFAULT_MODEL,
  DEFAULT_BASE_URL
} from '$lib/server/settings';

// GET /api/settings  (session-geschützt über hooks.server.ts)
//
// Liefert den Status der KI-Konfiguration. Der API-Key geht **niemals**
// im Klartext an den Client — nur ein Flag `has_key` und ein maskierter
// Hint („••••abcd") zur Orientierung.
export const GET: RequestHandler = async () => {
  const apiKey = await getApiKey();
  const model = await getModel();
  const baseURL = await getBaseUrl();
  return json({
    has_key: apiKey !== null && apiKey.trim() !== '',
    key_hint: apiKey ? maskKey(apiKey) : '',
    ai_model: model,
    ai_base_url: baseURL,
    default_model: DEFAULT_MODEL,
    default_base_url: DEFAULT_BASE_URL
  });
};

// PUT /api/settings  (session-geschützt über hooks.server.ts)
//
// Body (alle Felder optional):
//   { ai_api_key?: string,   // neu setzen; "" löscht den Key
//     ai_model?: string,     // Modell-String, z. B. "glm-4.6"
//     ai_base_url?: string } // OpenAI-kompatible Base-URL
//
// Jedes Feld wird nur geschrieben, wenn es im Body vorhanden ist. So kann
// z. B. nur das Modell aktualisiert werden, ohne Key/Base-URL erneut
// mitschicken zu müssen.
export const PUT: RequestHandler = async ({ request }) => {
  let body: { ai_api_key?: unknown; ai_model?: unknown; ai_base_url?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }

  if (body.ai_api_key !== undefined) {
    if (typeof body.ai_api_key !== 'string') {
      throw error(422, 'Feld "ai_api_key" muss ein String sein');
    }
    await setSetting(SETTINGS.AI_API_KEY, body.ai_api_key);
  }

  if (body.ai_model !== undefined) {
    if (typeof body.ai_model !== 'string') {
      throw error(422, 'Feld "ai_model" muss ein String sein');
    }
    await setSetting(SETTINGS.AI_MODEL, body.ai_model);
  }

  if (body.ai_base_url !== undefined) {
    if (typeof body.ai_base_url !== 'string') {
      throw error(422, 'Feld "ai_base_url" muss ein String sein');
    }
    await setSetting(SETTINGS.AI_BASE_URL, body.ai_base_url);
  }

  // Aktualisierten Status zurückgeben (gleiche Form wie GET).
  const apiKey = await getApiKey();
  const model = await getModel();
  const baseURL = await getBaseUrl();
  return json({
    has_key: apiKey !== null && apiKey.trim() !== '',
    key_hint: apiKey ? maskKey(apiKey) : '',
    ai_model: model,
    ai_base_url: baseURL,
    default_model: DEFAULT_MODEL,
    default_base_url: DEFAULT_BASE_URL
  });
};
