<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data } = $props();

  // Formular-Status. State aus einem Prop initialisieren → untrack(),
  // sonst state_referenced_locally-Warnung (s. CLAUDE.md Konventionen).
  let apiKeyInput = $state(''); // leer = unverändert (nur beim Setzen gesendet)
  let model = $state(untrack(() => data.ai_model ?? data.default_model));
  let baseURL = $state(untrack(() => data.ai_base_url ?? data.default_base_url));
  let busy = $state(false);
  let savedMsg = $state('');
  let errorMsg = $state('');

  // Status-Anzeige aus dem Server-Load (wird nach Speichern lokal aktualisiert)
  let hasKey = $state(untrack(() => data.has_key));
  let keyHint = $state(untrack(() => data.key_hint));

  // Vorgefertigte Provider-Presets (Base-URL + passendes Modell-Beispiel).
  // Trägt nur Base-URL/Modell ein, NICHT den Key (den muss der User immer
  // selbst beim jeweiligen Provider holen).
  const presets = [
    {
      label: 'z.ai (GLM)',
      baseURL: 'https://api.z.ai/api/paas/v4',
      model: 'glm-4.6',
      hint: 'Direkter z.ai-Zugang — dein z.ai-Abo. Key unter z.ai erstellen.'
    },
    {
      label: 'OpenRouter',
      baseURL: 'https://openrouter.ai/api/v1',
      model: 'z-ai/glm-4.6',
      hint: 'Proxy für viele Modelle — eigener OpenRouter-Key nötig.'
    },
    {
      label: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      hint: 'Direkter OpenAI-Zugang.'
    },
    {
      label: 'LM Studio (lokal)',
      baseURL: 'http://localhost:1234/v1',
      model: 'local-model',
      hint: 'Lokales Modell — läuft auf diesem Rechner, kein Key nötig.'
    }
  ];

  function applyPreset(p: (typeof presets)[number]) {
    baseURL = p.baseURL;
    model = p.model;
  }

  async function save(e: Event) {
    e.preventDefault();
    busy = true;
    savedMsg = '';
    errorMsg = '';
    try {
      const body: {
        ai_model: string;
        ai_base_url: string;
        ai_api_key?: string;
      } = {
        ai_model: model.trim() || data.default_model,
        ai_base_url: baseURL.trim() || data.default_base_url
      };
      // API-Key nur mitschicken, wenn der User etwas eingegeben hat
      // (sonst überschreiben wir nicht). Leerstring löscht bewusst.
      if (apiKeyInput !== '') {
        body.ai_api_key = apiKeyInput;
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (res.ok) {
        hasKey = result.has_key;
        keyHint = result.key_hint;
        model = result.ai_model;
        baseURL = result.ai_base_url;
        apiKeyInput = '';
        savedMsg = 'Einstellungen gespeichert.';
      } else {
        errorMsg = result.error || 'Speichern fehlgeschlagen.';
      }
    } catch {
      errorMsg = 'Verbindungsfehler.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Einstellungen – Koch-App</title>
</svelte:head>

<main class="container settings">
  <a href="/" class="back-link"><Icon name="back" size={16} /> Zurück</a>

  <h1><span class="h-ic"><Icon name="sparkles" size={28} /></span> KI-Einstellungen</h1>
  <p class="dim">
    Konfiguriere den Zugang zum KI-Assistenten. Es funktioniert jeder
    OpenAI-kompatible Anbieter (z. B. z.ai, OpenRouter, OpenAI oder ein
    lokales LM Studio). Die Daten werden nur auf diesem Server gespeichert.
  </p>

  <section class="card">
    <h2>Anbieter</h2>
    <p class="dim small">
      Wähle einen Anbieter als Vorlage oder gib Base-URL und Modell manuell ein.
    </p>
    <div class="presets">
      {#each presets as p}
        <button type="button" class="preset" onclick={() => applyPreset(p)}>
          {p.label}
        </button>
      {/each}
    </div>

    <form onsubmit={save} class="form">
      <label class="field">
        <span class="lbl">Base-URL</span>
        <input
          type="text"
          bind:value={baseURL}
          placeholder={data.default_base_url}
          autocomplete="off"
        />
        <span class="hint">OpenAI-kompatible API-URL des Anbieters.</span>
      </label>

      <label class="field">
        <span class="lbl">Modell</span>
        <input
          type="text"
          bind:value={model}
          placeholder={data.default_model}
          autocomplete="off"
        />
        <span class="hint">Modell-String des Anbieters, z. B. <code>glm-4.6</code>.</span>
      </label>

      <label class="field">
        <span class="lbl">API-Key</span>
        <input
          type="password"
          bind:value={apiKeyInput}
          placeholder={hasKey ? `Gesetzt (${keyHint}) – zum Ändern neu eingeben` : 'dein Anbieter-key'}
          autocomplete="off"
        />
        <span class="hint">Nur beim Anbieter hinterlegter Key. Wird nicht an den Browser übertragen.</span>
      </label>

      <button class="btn btn-primary" disabled={busy}>
        {busy ? 'Speichern…' : 'Speichern'}
      </button>
    </form>

    {#if savedMsg}<p class="ok">{savedMsg}</p>{/if}
    {#if errorMsg}<p class="err">{errorMsg}</p>{/if}

    {#if !hasKey}
      <p class="warn">
        <Icon name="info" size={16} /> Es ist noch kein API-Key gesetzt. Der
        KI-Assistent ist erst verfügbar, sobald du einen Key hinterlegst
        (bei lokalem LM Studio kann der Key leer bleiben).
      </p>
    {/if}
  </section>

  <p class="dim small">
    Hinweis: Der API-Key wird serverseitig gespeichert und nie an den
    Browser übertragen. Der Chat-Verlauf selbst wird nicht gespeichert.
  </p>
</main>

<style>
  .settings {
    padding-top: 16px;
  }
  .settings h1 {
    margin-top: 14px;
  }
  .dim {
    color: var(--dim);
    margin-bottom: 16px;
  }
  .small {
    font-size: 0.9rem;
  }
  .card {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px;
    margin-bottom: 16px;
  }
  .card h2 {
    margin-top: 0;
    margin-bottom: 8px;
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0 18px;
  }
  .preset {
    padding: 7px 13px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 0.88rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .preset:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 8px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lbl {
    font-size: 0.9rem;
    color: var(--dim);
  }
  .field input {
    min-height: var(--tap);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 1rem;
  }
  .field input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .hint {
    font-size: 0.8rem;
    color: var(--dim);
  }
  code {
    background: var(--surface);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  .ok {
    color: var(--success);
    margin-top: 12px;
  }
  .err {
    color: var(--danger);
    margin-top: 12px;
  }
  .warn {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    color: var(--warning, #e0a800);
    font-size: 0.9rem;
  }
  .h-ic {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    color: var(--accent);
  }
</style>
