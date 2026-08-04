import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRecipe, listCategories } from '$lib/server/queries';
import { getApiKey } from '$lib/server/settings';
import {
  finalizeRecipe,
  systemPromptNew,
  systemPromptImprove,
  NoApiKeyError,
  RecipeParseError,
  type ChatMessage,
  type ChatMode
} from '$lib/server/ai';

// POST /api/chat/finalize  (session-geschützt über hooks.server.ts)
//
// Nimmt den bisherigen Chat-Verlauf auf und liefert ein validiertes
// RecipeInput-JSON zurück, das der Client dann über POST /api/recipes
// (neu anlegen) bzw. PUT /api/recipes/[id] (überschreiben) speichert.
//
// Body (gleich wie /api/chat):
//   {
//     "messages": [...],
//     "mode": "new" | "improve",
//     "recipeId": number | null
//   }
//
// Antwort (200):
//   { "recipe": { ...RecipeInput } }

interface FinalizeRequestBody {
  messages?: unknown;
  mode?: unknown;
  recipeId?: unknown;
}

export const POST: RequestHandler = async ({ request }) => {
  let body: FinalizeRequestBody;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw error(422, 'Feld "messages" fehlt oder ist leer.');
  }
  const messages: ChatMessage[] = [];
  for (const m of body.messages) {
    if (
      m &&
      typeof m === 'object' &&
      typeof (m as { content?: unknown }).content === 'string'
    ) {
      const role = (m as { role?: string }).role;
      const content = (m as { content: string }).content;
      if (role === 'user' || role === 'assistant') {
        messages.push({ role, content });
      }
    }
  }
  if (messages.length === 0) {
    throw error(422, 'Keine gültigen Nachrichten übergeben.');
  }
  if (messages.length > 50) {
    throw error(422, 'Zu viele Nachrichten im Verlauf (max. 50).');
  }

  const mode: ChatMode = body.mode === 'improve' ? 'improve' : 'new';

  // Finalize braucht denselben System-Prompt wie der Chat (damit die KI
  // den besprochenen Kontext hat) — nur der User-Anker wird intern in
  // finalizeRecipe ergänzt ("erstelle jetzt das JSON").
  let systemPrompt: string;
  if (mode === 'improve') {
    const recipeId =
      typeof body.recipeId === 'number'
        ? body.recipeId
        : body.recipeId
          ? Number(body.recipeId)
          : null;
    if (!recipeId || !Number.isFinite(recipeId)) {
      throw error(422, 'Für Modus "improve" wird "recipeId" benötigt.');
    }
    const recipe = await getRecipe(recipeId);
    if (!recipe) throw error(404, 'Rezept nicht gefunden.');
    systemPrompt = systemPromptImprove(recipe);
  } else {
    const categories = await listCategories();
    systemPrompt = systemPromptNew(categories);
  }

  const apiKey = await getApiKey();
  if (!apiKey || apiKey.trim() === '') {
    return json({ error: 'Kein API-Key konfiguriert.', code: 'no_api_key' }, { status: 400 });
  }

  try {
    const recipe = await finalizeRecipe(messages, systemPrompt);
    return json({ recipe });
  } catch (err) {
    if (err instanceof NoApiKeyError) {
      return json({ error: err.message, code: 'no_api_key' }, { status: 400 });
    }
    if (err instanceof RecipeParseError) {
      return json({ error: `Die KI lieferte kein brauchbares Rezept: ${err.message}` }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler beim Finalisieren.';
    return json({ error: message }, { status: 502 });
  }
};
