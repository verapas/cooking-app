// === KI-Integration (server-only, provider-unabhängig) ===
//
// Kapselt die Anbindung an beliebige OpenAI-kompatible Provider (z. B.
// z.ai direkt, OpenRouter, OpenAI, lokales LM Studio). API-Key, Modell
// und Base-URL werden zur Laufzeit aus der `settings`-Tabelle gelesen,
// damit sie in der App (Einstellungs-Seite) wechselbar sind — ohne
// Server-Neustart.
//
// Zwei Funktionen:
//   • streamChat(messages, systemPrompt) → async-Generator von Text-Deltas
//     für die Konversations-Phase (Streaming).
//   • finalizeRecipe(messages, systemPrompt) → einzelner, nicht-streamender
//     Aufruf mit `response_format: json_object`, liefert geparstes
//     RecipeInput-JSON zum Anlegen/Überschreiben.
//
// Beliebig viele Provider laufen über denselben Code, da alle dem OpenAI-
// API-Standard folgen — nur die `baseURL` unterscheidet sich.

import OpenAI from 'openai';
import { getApiKey, getModel, getBaseUrl } from './settings';
import type { Category, RecipeInput, RecipeWithDetails } from '$lib/types';

// --- Typen ---

export type ChatRole = 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
}
export type ChatMode = 'new' | 'improve';

/** Wird geworfen, wenn kein API-Key konfiguriert ist. */
export class NoApiKeyError extends Error {
  constructor() {
    super('Kein API-Key konfiguriert.');
    this.name = 'NoApiKeyError';
  }
}

/** Wird geworfen, wenn die KI kein valides Rezept-JSON liefert. */
export class RecipeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeParseError';
  }
}

// --- Client-Erzeugung (pro Aufruf, da Key/Modell/Base-URL zur Laufzeit wechseln) ---

async function createClient(): Promise<{ client: OpenAI; model: string }> {
  const apiKey = await getApiKey();
  if (!apiKey || apiKey.trim() === '') throw new NoApiKeyError();
  const model = await getModel();
  const baseURL = await getBaseUrl();
  const client = new OpenAI({ apiKey, baseURL });
  return { client, model };
}

// =====================================================================
// System-Prompts
// =====================================================================

/**
 * Baut die Liste der Kategorien zu einem Hinweis-String für den Prompt
 * (damit die KI einen existierenden category_slug verwenden kann).
 */
function categoryHint(categories: Category[]): string {
  if (categories.length === 0) {
    return 'Es sind aktuell keine Kategorien vorhanden. Lass category_slug weg.';
  }
  const list = categories
    .map((c) => `${c.slug} (${c.name})`)
    .join(', ');
  return `Verfügbare Kategorien (slug → Name): ${list}. Verwende einen dieser Slugs für "category_slug". Passen keine, lass das Feld weg.`;
}

/**
 * Beschreibt das JSON-Schema, das finalizeRecipe erzwingt. Das entspricht
 * exakt RecipeInput/StepInput/IngredientInput (src/lib/types.ts), gekürzt
 * um die internen Felder (id, recipe_id, …).
 */
export const RECIPE_JSON_SCHEMA_DESCRIPTION = `Ein JSON-Objekt mit genau dieser Form:
{
  "title": "string (Pflicht)",
  "description": "string | null — kurze Beschreibung (optional)",
  "category_slug": "string | null — Slug einer vorhandenen Kategorie (optional)",
  "base_servings": "number — Standard-Portionen, z. B. 2 (optional, default 2)",
  "prep_time_min": "number | null — Vorbereitungszeit in Minuten (optional)",
  "cook_time_min": "number | null — Koch-/Backzeit in Minuten (optional)",
  "source": "string | null — Quelle, z. B. 'KI generiert' (optional)",
  "steps": [
    { "order": number (1-basiert), "instruction": "string", "duration_sec": number | null }
  ],
  "ingredients": [
    {
      "name": "string",
      "quantity": "number — numerisch! z. B. 250 (niemals "250"); 0/null = 'nach Geschmack'",
      "unit": "string | null — z. B. 'g', 'ml', 'EL'",
      "step_order": "number — MUSS gesetzt sein! Verweist auf den 'order'-Wert des Schritts, in dem diese Zutat verwendet wird (1-basiert). Jede Zutat gehört zu genau einem Schritt."
    }
  ]
}`;

/**
 * System-Prompt für die Chat-Phase (Modus 'new'): offene Konversation zum
 * Planen eines Rezepts. Die KI darf Fragen stellen, Vorschläge machen.
 * Erst in der Finalize-Phase wird das Rezept-JSON erzeugt.
 */
export function systemPromptNew(categories: Category[]): string {
  return `Du bist ein einfühlsamer, kreativer Koch-Assistent in einer deutschen Rezept-App. Du hilfst der Person, ein leckeres Rezept zu planen.

Verhalte dich natürlich:
- Stelle bei Bedarf Rückfragen (Portionen, Ernährungsweise, Geschmack, verfügbarer Zeitaufwand, Vorräte).
- Mache konkrete Vorschläge und erkläre kurz, warum sie passen.
- Antworte auf Deutsch, freundlich und kompakt (nicht endlos lang).
- Du planst nur im Gespräch. Es geht noch nicht darum, ein fertiges Rezept auszugeben.

${categoryHint(categories)}

Wenn die Person zufrieden ist, wird sie dich separat auffordern, das Rezept zu erstellen — dann lieferst du strukturiertes JSON. Im Chat-Verlauf bleibst du beim normalen Gesprächsfluss.`;
}

/**
 * System-Prompt für die Chat-Phase (Modus 'improve'): es liegt ein
 * bestehendes Rezept vor, das angepasst/verbessert werden soll.
 */
export function systemPromptImprove(recipe: RecipeWithDetails): string {
  const steps = recipe.steps
    .map((s) => `  ${s.order}. ${s.instruction}${s.duration_sec ? ` (${s.duration_sec}s)` : ''}`)
    .join('\n');
  const ings = recipe.ingredients
    .map(
      (i) =>
        `  - ${i.name}${i.quantity ? ` ${i.quantity}${i.unit ? ' ' + i.unit : ''}` : ' (nach Geschmack)'}`
    )
    .join('\n');
  return `Du bist ein Koch-Assistent in einer deutschen Rezept-App. Die Person möchte das folgende Rezept verbessern oder anpassen (z. B. gesünder, schneller, andere Portionen, vegetarisch, andere Gewürze).

Bestehendes Rezept:
- Titel: ${recipe.title}
- Beschreibung: ${recipe.description ?? '—'}
- Kategorie: ${recipe.category?.name ?? '—'}
- Portionen: ${recipe.base_servings}
- Vorbereitung: ${recipe.prep_time_min ?? '—'} min / Kochen: ${recipe.cook_time_min ?? '—'} min
- Zutaten:
${ings || '  (keine)'}
- Schritte:
${steps || '  (keine)'}

Verhalte dich natürlich:
- Frage bei Bedarf nach, in welche Richtung die Anpassung gehen soll.
- Mache konkrete Vorschläge und begründe sie kurz.
- Antworte auf Deutsch, freundlich und kompakt.

Wenn die Person zufrieden ist, wird sie das Rezept separat finalisieren lassen — dann lieferst du strukturiertes JSON. Im Chat-Verlauf bleibst du beim normalen Gesprächsfluss.`;
}

/** System-Prompt für die Finalize-Phase: erzwingt das Rezept-JSON. */
function finalizeSystemPrompt(categories: Category[]): string {
  return `Du bist ein Rezept-Generator in einer deutschen Rezept-App. Gib AUSSCHLIESSLICH ein gültiges JSON-Objekt aus — keinen Erklärungstext, kein Markdown, keine Code-Einfassung.

${RECIPE_JSON_SCHEMA_DESCRIPTION}

${categoryHint(categories)}

Regeln:
- "quantity" MUSS numerisch sein (number), niemals ein String. Verwende 0 oder null für "nach Geschmack".
- WICHTIG — Zutaten zu Schritten: JEDER Zutat MUSS ein "step_order"-Wert zugewiesen werden, der auf den "order"-Wert des Schritts verweist, in dem sie verwendet wird (z. B. "step_order": 1 → gehört zu Schritt mit "order": 1). Keine Zutat darf ohne "step_order" bleiben. Ordne jede Zutat dem Schritt zu, in dem sie tatsächlich gebraucht wird.
- "step_order" und "quantity" müssen echten Zahlen (number) sein, keine Strings.
- Alle Texte auf Deutsch.
- Liefere nur das JSON-Objekt, sonst nichts.`;
}

// =====================================================================
// Chat-Phase: Streaming
// =====================================================================

/**
 * Streamt die KI-Antwort als Folge von Text-Deltas. Der Aufrufer bekommt
 * nach und nach Text-Fragmente und kann sie an den Client weiterreichen.
 *
 * Der System-Prompt wird hier NICHT mit eingereiht — der Aufrufer (API-
 * Route) übergibt nur die user/assistant-Nachrichten aus dem Client-Verlauf.
 */
export async function* streamChat(
  messages: ChatMessage[],
  systemPrompt: string
): AsyncGenerator<string, void, unknown> {
  const { client, model } = await createClient();
  const stream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content }))
    ]
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

// =====================================================================
// Finalize-Phase: strukturiertes Rezept-JSON
// =====================================================================

/**
 * Ruft die KI einmalig (ohne Streaming) auf und liefert das als JSON
 * geparste RecipeInput. Wirft RecipeParseError, wenn die Antwort nicht
 * als Rezept-JSON interpretiert werden kann.
 *
 * Der bisherige Chat-Verlauf (messages) wird als Kontext mitgegeben,
 * damit die KI das besprochene Rezept produziert.
 */
export async function finalizeRecipe(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<RecipeInput> {
  const { client, model } = await createClient();
  const completion = await client.chat.completions.create({
    model,
    // JSON-Modus erzwingen — weitreichend unterstützt (auch GLM).
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      {
        // Expliziter Anker: die KI soll jetzt das finale Rezept ausgeben.
        role: 'user',
        content:
          'Bitte erstelle nun das fertige Rezept als JSON-Objekt gemäß dem Schema. Kein Erklärungstext.'
      }
    ]
  });

  const raw = completion.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new RecipeParseError('Die KI hat keine Antwort geliefert.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RecipeParseError('Die Antwort der KI ist kein gültiges JSON.');
  }
  return validateRecipeInput(parsed);
}

// =====================================================================
// Validierung des KI-JSON gegen RecipeInput
// =====================================================================

/**
 * Validiert und normalisiert das rohe KI-Objekt zu einem RecipeInput, das
 * direkt in createRecipe/updateRecipe gesteckt werden kann. Wirft bei
 * unbrauchbaren Daten RecipeParseError.
 */
export function validateRecipeInput(raw: unknown): RecipeInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new RecipeParseError('Rezept-JSON fehlt oder ist kein Objekt.');
  }
  const obj = raw as Record<string, unknown>;

  const title = typeof obj.title === 'string' ? obj.title.trim() : '';
  if (!title) throw new RecipeParseError('Feld "title" fehlt oder ist leer.');

  const recipe: RecipeInput = { title };

  if (typeof obj.description === 'string') {
    recipe.description = obj.description.trim() || null;
  }
  if (typeof obj.category_slug === 'string' && obj.category_slug.trim()) {
    recipe.category_slug = obj.category_slug.trim();
  }
  if (typeof obj.base_servings === 'number' && obj.base_servings > 0) {
    recipe.base_servings = Math.floor(obj.base_servings);
  }
  if (typeof obj.prep_time_min === 'number' && obj.prep_time_min >= 0) {
    recipe.prep_time_min = Math.floor(obj.prep_time_min);
  }
  if (typeof obj.cook_time_min === 'number' && obj.cook_time_min >= 0) {
    recipe.cook_time_min = Math.floor(obj.cook_time_min);
  }
  if (typeof obj.source === 'string') {
    recipe.source = obj.source.trim() || null;
  }

  if (Array.isArray(obj.steps)) {
    recipe.steps = obj.steps
      .map((s, idx) => normalizeStep(s, idx))
      .filter((s): s is NonNullable<typeof s> => s !== null);
  } else if (Array.isArray(obj.instructions)) {
    // Manche Modelle nennen das Feld "instructions" statt "steps".
    recipe.steps = (obj.instructions as unknown[])
      .map((s, idx) => normalizeStep(s, idx))
      .filter((s): s is NonNullable<typeof s> => s !== null);
  } else if (Array.isArray(obj.preparation)) {
    // …oder "preparation".
    recipe.steps = (obj.preparation as unknown[])
      .map((s, idx) => normalizeStep(s, idx))
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }
  if (Array.isArray(obj.ingredients)) {
    recipe.ingredients = obj.ingredients
      .map((i) => normalizeIngredient(i))
      .filter((i): i is NonNullable<typeof i> => i !== null);
  }

  return recipe;
}

/**
 * Wandelt einen Wert in eine Number um, wenn möglich — akzeptiert echtes
 * Number-Typen UND numerische Strings ("250" → 250). Gibt null zurück bei
 * nicht-numerischen Werten ("etwas", "nach Geschmack") oder Fehlen.
 * Wichtig, weil manche Modelle quantity als String liefern.
 */
function toNumberOrNull(raw: unknown): number | null {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  if (typeof raw === 'string') {
    // Komma → Punkt (deutsche Dezimalschreibweise), dann parse.
    const normalized = raw.replace(',', '.').trim();
    // Reine Bruch-/Mengen-Angaben wie "1/2" approximieren.
    if (/^\d+\/\d+$/.test(normalized)) {
      const [a, b] = normalized.split('/').map(Number);
      if (b > 0) return a / b;
    }
    const n = Number(normalized);
    if (!Number.isNaN(n) && normalized !== '') return n;
  }
  return null;
}

/**
 * Liest einen String-Wert aus mehreren möglichen Feldnamen aus dem Roh-
 * objekt (Modelle variieren bei der Benennung). Erster Treffer gewinnt.
 */
function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function normalizeStep(raw: unknown, idx: number) {
  // Schritt kann entweder ein Objekt sein oder ein reiner String.
  if (typeof raw === 'string' && raw.trim()) {
    return { order: idx + 1, instruction: raw.trim(), duration_sec: null };
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const instruction =
    pickString(s, ['instruction', 'text', 'description', 'step']) ?? '';
  if (!instruction) return null;
  const orderRaw = s.order ?? s.step ?? s.number;
  const order =
    typeof orderRaw === 'number' && orderRaw > 0 ? orderRaw : idx + 1;
  const duration_sec =
    typeof s.duration_sec === 'number' && s.duration_sec > 0
      ? Math.floor(s.duration_sec)
      : null;
  return { order, instruction, duration_sec };
}

function normalizeIngredient(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) return null;
  const i = raw as Record<string, unknown>;
  const name = pickString(i, ['name', 'ingredient', 'item']) ?? '';
  if (!name) return null;
  // quantity defensiv: Number ODER numerischer String ("250"/"0,5").
  const quantity = toNumberOrNull(i.quantity ?? i.amount ?? i.qty);
  const unit = pickString(i, ['unit', 'units', 'measure']) ?? null;
  // step_order defensiv: Number ODER numerischer String ("1"). Verweist
  // auf den "order"-Wert des zugehörigen Schritts (1-basiert).
  const stepOrderRaw = i.step_order ?? i.step ?? i.step_number;
  const stepOrderNum = toNumberOrNull(stepOrderRaw);
  const step_order = stepOrderNum !== null && stepOrderNum > 0 ? stepOrderNum : null;
  return { name, quantity, unit, step_order };
}
