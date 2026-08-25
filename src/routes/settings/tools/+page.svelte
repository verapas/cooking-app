<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // State aus einem Prop initialisieren → untrack(), sonst
  // state_referenced_locally-Warnung (s. CLAUDE.md Konventionen).
  let tools = $state(untrack(() => [...data.tools]));
  let newName = $state('');
  let busy = $state(false);
  let errorMsg = $state('');

  async function addTool(e: Event) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;

    busy = true;
    errorMsg = '';
    try {
      const res = await fetch('/api/kitchen-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name })
      });
      const result = await res.json();
      if (res.ok) {
        // Duplikat (case-insensitiv) nicht doppelt in die Liste legen.
        const exists = tools.some(
          (t) => t.name.toLowerCase() === name.toLowerCase() || t.id === result.id
        );
        if (!exists) tools = [...tools, result];
        tools = [...tools].sort((a, b) => a.name.localeCompare(b.name, 'de'));
        newName = '';
      } else {
        errorMsg = result.error || 'Hinzufügen fehlgeschlagen.';
      }
    } catch {
      errorMsg = 'Verbindungsfehler.';
    } finally {
      busy = false;
    }
  }

  async function removeTool(id: number) {
    if (busy) return;
    busy = true;
    errorMsg = '';
    try {
      const res = await fetch(`/api/kitchen-tools/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        tools = tools.filter((t) => t.id !== id);
      } else {
        const result = await res.json().catch(() => ({}));
        errorMsg = result.error || 'Löschen fehlgeschlagen.';
      }
    } catch {
      errorMsg = 'Verbindungsfehler.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Küchenutensilien – Koch-App</title>
</svelte:head>

<main class="container settings">
  <a href="/settings" class="back-link"><Icon name="back" size={16} /> Einstellungen</a>

  <h1><span class="h-ic"><Icon name="pot" size={28} /></span> Küchenutensilien</h1>
  <p class="dim">
    Hinterlege, welche Utensilien und Geräte in deiner Küche vorhanden sind
    (z.&nbsp;B. Ofen, Airfryer, Knethacken). Der KI-Assistent berücksichtigt
    diese Liste beim Vorschlagen und Erstellen von Rezepten.
  </p>

  <section class="card">
    <form onsubmit={addTool} class="add-form">
      <input
        type="text"
        bind:value={newName}
        placeholder="z. B. Airfryer"
        maxlength="80"
        autocomplete="off"
        aria-label="Neues Utensil"
      />
      <button type="submit" class="btn btn-primary" disabled={busy || !newName.trim()}>
        {busy ? '…' : 'Hinzufügen'}
      </button>
    </form>

    {#if errorMsg}<p class="err">{errorMsg}</p>{/if}

    {#if tools.length === 0}
      <p class="empty">
        <Icon name="info" size={16} />
        Noch keine Utensilien hinterlegt. Füge hinzu, was in deiner Küche steht —
        oder lasse die Liste leer, dann schlägt die KI Standard-Zubereitungen vor.
      </p>
    {:else}
      <ul class="chips">
        {#each tools as tool (tool.id)}
          <li class="chip">
            <span class="chip-name">{tool.name}</span>
            <button
              type="button"
              class="chip-remove"
              onclick={() => removeTool(tool.id)}
              disabled={busy}
              aria-label={`"${tool.name}" entfernen`}
            >
              <Icon name="close" size={14} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <p class="dim small">
    Die Liste wird serverseitig gespeichert und fließt als kurze Info in jeden
    KI-Chat ein (neue Rezepte, Verbesserungen und Finalisierung).
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
  .add-form {
    display: flex;
    gap: 8px;
  }
  .add-form input {
    flex: 1;
    min-width: 0;
    min-height: var(--tap);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 1rem;
  }
  .add-form input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .add-form .btn {
    flex-shrink: 0;
    min-height: var(--tap);
    padding: 10px 16px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .err {
    color: var(--danger);
    margin-top: 12px;
  }
  .empty {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    color: var(--dim);
    font-size: 0.9rem;
  }
  .chips {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 16px 0 0;
    padding: 0;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 8px 8px 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 0.92rem;
  }
  .chip-name {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: var(--dim);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .chip-remove:hover:not(:disabled) {
    background: rgba(255, 92, 92, 0.15);
    color: var(--danger);
  }
  .chip-remove:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .h-ic {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    color: var(--accent);
  }
</style>
