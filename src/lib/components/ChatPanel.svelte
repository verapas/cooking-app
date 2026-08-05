<script lang="ts">
  // === Wiederverwendbare Chat-Komponente (KI-Rezept-Assistent) ===
  //
  // Übernimmt: Nachrichtenliste, Streaming-Lesen (SSE), Finalize-Vorschau
  // und das Speichern über die bestehenden REST-Endpunkte. Der Chat-
  // Verlauf lebt nur im Speicher (nicht persistiert).
  //
  // Props:
  //   mode: 'new' | 'improve'
  //   recipeId?: number        — Rezept, das verbessert wird (mode='improve')
  //   mainRecipeId?: number    — Hauptrezept-ID für neue Versionen
  //   contextTitle?: string    — Titel des Kontext-Rezepts (nur Anzeige)
  //   onsaved: (id: number) => void  — nach erfolgreichem Speichern

  import { untrack } from 'svelte';
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';
  import type { RecipeInput } from '$lib/types';

  let {
    mode = 'new',
    recipeId = null,
    mainRecipeId = null,
    contextTitle = '',
    onsaved
  }: {
    mode?: 'new' | 'improve';
    recipeId?: number | null;
    mainRecipeId?: number | null;
    contextTitle?: string;
    onsaved?: (id: number) => void;
  } = $props();

  type Msg = { role: 'user' | 'assistant'; content: string };

  // --- Chat-Status (nur im Speicher, nicht persistiert) ---
  let messages = $state<Msg[]>([]);
  let input = $state('');
  let streaming = $state(false);
  let errorMsg = $state('');

  // --- Finalize / Vorschau / Speichern ---
  let finalizing = $state(false);
  let preview = $state<RecipeInput | null>(null);
  let versionName = $state('');
  let saving = $state(false);
  let saveError = $state('');
  let savedId = $state<number | null>(null);

  let scrollEl = $state<HTMLDivElement | null>(null);
  let inputEl = $state<HTMLTextAreaElement | null>(null);

  /**
   * Passt die Höhe des Eingabefelds an den Inhalt an (auto-grow). Setzt
   * erst auf auto, damit scrollHeight den echten Bedarf liefert, und
   * begrenzt oben durch max-height (CSS). Wird beim Tippen und beim
   * Leeren (nach Senden) aufgerufen.
   */
  function autoGrow() {
    const el = inputEl;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  // Reagiere auf Eingabe-Änderungen (Svelte 5 Runes: auf `input` lauschen).
  $effect(() => {
    void input;
    autoGrow();
  });

  // Begrüßungsnachricht einmalig beim Mount (untrack, da aus Props init).
  $effect(() => {
    if (messages.length === 0) {
      const greeting =
        mode === 'improve'
          ? `Ich helfe dir gerne, „${contextTitle || 'dieses Rezept'}" anzupassen. Was möchtest du verändern? (z. B. schneller, mehr Portionen, andere Gewürze)`
          : 'Hallo! Ich helfe dir, ein Rezept zu planen. Was hast du vor — welche Art Gericht, wie viele Portionen, welche Zutaten hast du da?';
      untrack(() => {
        messages = [{ role: 'assistant', content: greeting }];
      });
    }
  });

  // Auto-Scroll ans Ende bei neuen Nachrichten / Streaming-Deltas.
  $effect(() => {
    // auf messages + streaming reagieren
    void messages.length;
    void streaming;
    tick().then(() => {
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    });
  });

  let canSend = $derived(input.trim().length > 0 && !streaming);
  let canFinalize = $derived(messages.length >= 2 && !streaming && !finalizing && !preview);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    errorMsg = '';
    input = '';
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    messages = next;

    // Platzhalter für die streamende Antwort.
    messages = [...next, { role: 'assistant', content: '' }];
    streaming = true;

    try {
      // Nur user/assistant bis zur Frage senden (ohne den leeren Platzhalter).
      const history = next;
      await streamInto(history, (delta) => {
        // Letzte Nachricht (= Platzhalter) um delta ergänzen.
        messages = messages.map((m, i) =>
          i === messages.length - 1 ? { ...m, content: m.content + delta } : m
        );
      });
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Verbindungsfehler.';
      // Platzhalter wieder entfernen, wenn nichts kam.
      messages = messages.filter((m, i) => !(i === messages.length - 1 && m.content === ''));
    } finally {
      streaming = false;
    }
  }

  /**
   * Ruft POST /api/chat auf und streamt die Antwort tokenweise in den
   * callback. Behandelt sowohl SSE-Deltas als auch pre-stream JSON-Fehler.
   */
  async function streamInto(history: Msg[], onDelta: (d: string) => void): Promise<void> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ messages: history, mode, recipeId })
    });

    const ct = res.headers.get('content-type') ?? '';
    if (!res.ok || !ct.includes('text/event-stream')) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Fehler (${res.status}).`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let gotAny = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // unvollständige Zeile zurückhalten
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') {
          return;
        }
        try {
          const obj = JSON.parse(payload) as { delta?: string; error?: string };
          if (obj.error) throw new Error(obj.error);
          if (obj.delta) {
            gotAny = true;
            onDelta(obj.delta);
          }
        } catch (e) {
          // Parse-Fehler ignorieren wir, echte Fehler werden oben geworfen.
          if (e instanceof Error && e.message && e.message !== 'Unexpected token') {
            // Re-throw nur, wenn es eine echte Fehlermeldung ist.
            throw e;
          }
        }
      }
    }
    if (!gotAny) {
      throw new Error('Keine Antwort erhalten.');
    }
  }

  // --- Finalize: strukturiertes Rezept anfordern ---
  async function finalize() {
    if (finalizing) return;
    finalizing = true;
    saveError = '';
    errorMsg = '';
    try {
      const res = await fetch('/api/chat/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages, mode, recipeId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Fehler (${res.status}).`);
      }
      preview = data.recipe as RecipeInput;
      // Versionsname: bevorzugt den Vorschlag der KI nutzen (z. B.
      // "Mit Hüttenkäse"), sonst erst den Titel, dann ein Fallback.
      // So steht im Dropdown etwas Aussagekräftiges statt "KI-Variante".
      if (mode === 'improve') {
        versionName =
          preview.version_name ||
          preview.title ||
          contextTitle ||
          'Variante';
      }
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Finalisieren fehlgeschlagen.';
    } finally {
      finalizing = false;
    }
  }

  function discardPreview() {
    preview = null;
    saveError = '';
  }

  // --- Speichern über die bestehenden REST-Endpunkte ---

  async function saveNew() {
    if (!preview || saving) return;
    saving = true;
    saveError = '';
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preview)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Fehler (${res.status}).`);
      savedId = data.id as number;
      onsaved?.(data.id);
    } catch (err) {
      saveError = err instanceof Error ? err.message : 'Speichern fehlgeschlagen.';
    } finally {
      saving = false;
    }
  }

  async function saveOverwrite() {
    if (!preview || !recipeId || saving) return;
    saving = true;
    saveError = '';
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preview)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Fehler (${res.status}).`);
      savedId = recipeId;
      onsaved?.(recipeId);
    } catch (err) {
      saveError = err instanceof Error ? err.message : 'Speichern fehlgeschlagen.';
    } finally {
      saving = false;
    }
  }

  async function saveVersion() {
    if (!preview || saving) return;
    const parent = mainRecipeId ?? recipeId;
    if (!parent) {
      saveError = 'Hauptrezept konnte nicht ermittelt werden.';
      return;
    }
    saving = true;
    saveError = '';
    try {
      const body: RecipeInput = {
        ...preview,
        parent_recipe_id: parent,
        // version_name aus dem (editierbaren) Feld, sonst aus dem KI-
        // Vorschlag, sonst Titel, letzter Fallback "Variante".
        version_name:
          versionName.trim() ||
          preview.version_name ||
          preview.title ||
          'Variante'
      };
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Fehler (${res.status}).`);
      savedId = data.id as number;
      onsaved?.(data.id);
    } catch (err) {
      saveError = err instanceof Error ? err.message : 'Speichern fehlgeschlagen.';
    } finally {
      saving = false;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
</script>

<div class="chat-wrap">
  {#if preview}
    <!-- ===================== Vorschau + Speichern ===================== -->
    <div class="preview-card">
      <div class="preview-head">
        <span class="ph-ic"><Icon name="chef" size={20} /></span>
        <h2>Vorschau: {preview.title}</h2>
      </div>

      {#if preview.description}<p class="preview-desc">{preview.description}</p>{/if}

      <div class="preview-meta">
        {#if preview.base_servings}<span>🍽️ {preview.base_servings} Portionen</span>{/if}
        {#if preview.prep_time_min}<span>⏱️ Prep {preview.prep_time_min} min</span>{/if}
        {#if preview.cook_time_min}<span>🔥 Kochen {preview.cook_time_min} min</span>{/if}
        {#if preview.category_slug}<span>📁 {preview.category_slug}</span>{/if}
      </div>

      {#if preview.ingredients?.length}
        <h3>Zutaten</h3>
        <ul class="pv-list">
          {#each preview.ingredients as ing}
            <li>
              <span class="pv-name">{ing.name}</span>
              {#if ing.quantity}
                <span class="pv-qty">{ing.quantity}{ing.unit ? ' ' + ing.unit : ''}</span>
              {:else}
                <span class="pv-qty dim">nach Geschmack</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      {#if preview.steps?.length}
        <h3>Zubereitung</h3>
        <ol class="pv-steps">
          {#each preview.steps as step}
            <li>{step.instruction}</li>
          {/each}
        </ol>
      {/if}

      {#if mode === 'improve'}
        <div class="version-field">
          <label for="ver-name">Name der neuen Version</label>
          <input id="ver-name" type="text" bind:value={versionName} maxlength="80" />
        </div>
      {/if}

      {#if saveError}<p class="err">{saveError}</p>{/if}

      <div class="preview-actions">
        <button class="btn btn-ghost" onclick={discardPreview} disabled={saving}>
          Zurück zum Chat
        </button>
        {#if mode === 'new'}
          <button class="btn btn-primary" onclick={saveNew} disabled={saving}>
            {saving ? 'Speichere…' : 'Rezept anlegen'}
          </button>
        {:else}
          <button class="btn btn-primary" onclick={saveOverwrite} disabled={saving}>
            {saving ? 'Speichere…' : 'Original überschreiben'}
          </button>
          <button class="btn btn-secondary" onclick={saveVersion} disabled={saving}>
            {saving ? 'Speichere…' : 'Als neue Version'}
          </button>
        {/if}
      </div>
    </div>
  {:else}
    <!-- ===================== Konversation ===================== -->
    <div class="messages" bind:this={scrollEl}>
      {#each messages as m (messages.indexOf(m))}
        <div class="msg {m.role}">
          {#if m.role === 'assistant' && m.content === '' && streaming}
            <!-- Letzter (leerer) Assistant-Bubble: Typing-Indikator IN der Bubble -->
            <div class="bubble bubble-typing">
              <span class="dots"><span></span><span></span><span></span></span>
            </div>
          {:else}
            <div class="bubble">{m.content}</div>
          {/if}
        </div>
      {/each}
      {#if errorMsg}<p class="err chat-err">{errorMsg}</p>{/if}
    </div>

    <div class="finalize-bar">
      <button class="btn btn-secondary btn-finalize" onclick={finalize} disabled={!canFinalize}>
        {#if finalizing}
          <span class="spinner" aria-hidden="true"></span>
          Erstelle Rezept…
        {:else}
          <Icon name="check" size={18} /> Rezept aus Chat erstellen
        {/if}
      </button>
    </div>

    <form class="composer" onsubmit={(e) => { e.preventDefault(); send(); }}>
      <textarea
        bind:this={inputEl}
        bind:value={input}
        oninput={autoGrow}
        onkeydown={onKeydown}
        placeholder="Nachricht an den KI-Assistenten…"
        rows="1"
        disabled={streaming}
      ></textarea>
      <button type="submit" class="send-btn" disabled={!canSend} aria-label="Senden">
        <Icon name="send" size={20} />
      </button>
    </form>
  {/if}
</div>

<style>
  .chat-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /* --- Konversation --- */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 14px 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .msg {
    display: flex;
  }
  .msg.user {
    justify-content: flex-end;
  }
  .bubble {
    max-width: 85%;
    padding: 9px 13px;
    border-radius: 16px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .msg.user .bubble {
    background: var(--accent);
    color: var(--on-accent, #fff);
    border-bottom-right-radius: 4px;
  }
  .msg.assistant .bubble {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-bottom-left-radius: 4px;
  }
  /* Typing-Indikator: drei hüpfende Punkte in der Assistant-Bubble,
     deutlich sichtbar während die KI noch keinen Text gesendet hat. */
  .bubble-typing {
    padding: 14px 16px;
  }
  .dots {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    line-height: 0;
  }
  .dots span {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--accent);
    animation: dot-bounce 1.2s infinite ease-in-out both;
  }
  .dots span:nth-child(1) { animation-delay: -0.32s; }
  .dots span:nth-child(2) { animation-delay: -0.16s; }
  .dots span:nth-child(3) { animation-delay: 0s; }
  @keyframes dot-bounce {
    0%, 80%, 100% { transform: scale(0.5); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }
  .chat-err {
    font-size: 0.85rem;
  }

  /* Spinner für den Finalize-Button (während „Erstelle Rezept…"). */
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
    border-top-color: currentColor;
    border-radius: 50%;
    display: inline-block;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* --- Finalize-Leiste --- */
  .finalize-bar {
    padding: 6px 0;
    display: flex;
    justify-content: center;
  }
  .btn-finalize {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  /* --- Composer --- */
  .composer {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    /* Mehr Abstand nach unten (vor allem auf Mobile mit Home-Indikator). */
    padding: 10px 0 calc(16px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
  }
  .composer textarea {
    flex: 1;
    resize: none;
    min-height: 44px;
    max-height: 140px;
    /* autoGrow macht das Feld groß genug → keine Scrollbar nötig. Scrollen
       bei langem Text geht trotzdem (Mausrad/Trackpad), nur ohne Leiste. */
    overflow-y: auto;
    /* Scrollbar verbergen: Chrome/Edge/Safari zeigen sonst beim Stylen
       dauerhaft eine Scrollbar-Spur. */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* ältere IE/Edge */
    padding: 11px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font-size: 1rem;
    font-family: inherit;
    line-height: 1.4;
    transition: height 0.05s ease;
  }
  /* WebKit/Blink: Scrollbar komplett ausblenden (Chat-Input-Standard). */
  .composer textarea::-webkit-scrollbar {
    display: none;
  }
  .composer textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
  .send-btn {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--on-accent, #fff);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* --- Vorschau --- */
  .preview-card {
    overflow-y: auto;
    padding: 4px;
  }
  .preview-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .preview-head h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .ph-ic {
    display: inline-flex;
    color: var(--accent);
  }
  .preview-desc {
    color: var(--dim);
    margin: 8px 0 12px;
  }
  .preview-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin-bottom: 14px;
    font-size: 0.9rem;
    color: var(--dim);
  }
  .preview-card h3 {
    margin: 14px 0 6px;
    font-size: 1rem;
  }
  .pv-list {
    list-style: none;
    padding: 0;
    margin: 0 0 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pv-list li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 8px;
    background: var(--surface-2);
    border-radius: 6px;
  }
  .pv-qty {
    font-weight: 600;
    white-space: nowrap;
  }
  .pv-qty.dim {
    color: var(--dim);
    font-weight: 400;
    font-style: italic;
  }
  .pv-steps {
    padding-left: 20px;
    margin: 0 0 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    line-height: 1.45;
  }
  .version-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin: 14px 0;
  }
  .version-field label {
    font-size: 0.85rem;
    color: var(--dim);
  }
  .version-field input {
    min-height: 40px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font-size: 0.95rem;
  }
  .preview-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }
  .err {
    color: var(--danger);
    margin-top: 10px;
    font-size: 0.9rem;
  }
</style>
