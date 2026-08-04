import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRecipe, listCategories } from '$lib/server/queries';
import { getApiKey } from '$lib/server/settings';
import {
  streamChat,
  systemPromptNew,
  systemPromptImprove,
  type ChatMessage,
  type ChatMode
} from '$lib/server/ai';

// POST /api/chat  (session-geschützt über hooks.server.ts)
//
// Body:
//   {
//     "messages": [{ "role": "user"|"assistant", "content": "..." }, ...],
//     "mode": "new" | "improve",       // default "new"
//     "recipeId": number | null        // Pflicht bei mode="improve"
//   }
//
// Antwort: Server-Sent-Events-Stream (text/event-stream). Jedes Delta
// kommt als `data: {"delta": "..."}`; das Ende wird mit `data: [DONE]`
// markiert. Fehler VOR dem Stream (fehlender API-Key, Bad Request) werden
// als reguläre JSON-Fehler zurückgegeben, damit der Client sie einfach
// auswerten kann. Tritt während des Streamens ein Fehler auf, wird ein
// `data: {"error": "..."}`-Event gesendet und der Stream geschlossen.

interface ChatRequestBody {
  messages?: unknown;
  mode?: unknown;
  recipeId?: unknown;
}

export const POST: RequestHandler = async ({ request }) => {
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Ungültiges JSON');
  }

  // --- Nachrichten validieren ---
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
  // Sicherheitsgrenze: Verlauf nicht beliebig wachsen lassen.
  if (messages.length > 50) {
    throw error(422, 'Zu viele Nachrichten im Verlauf (max. 50).');
  }

  const mode: ChatMode = body.mode === 'improve' ? 'improve' : 'new';

  // --- System-Prompt nach Modus wählen ---
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

  // --- Key-Check VOR dem Stream: klare JSON-Fehlermeldung ---
  const apiKey = await getApiKey();
  if (!apiKey || apiKey.trim() === '') {
    return json({ error: 'Kein API-Key konfiguriert.', code: 'no_api_key' }, { status: 400 });
  }

  // --- Stream als SSE zurückgeben ---
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const delta of streamChat(messages, systemPrompt)) {
          send({ delta });
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unbekannter Fehler beim Streamen.';
        send({ error: message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
};
