<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { PageData } from './$types';
  import type { TagWithCount } from '$lib/types';

  let { data }: { data: PageData } = $props();

  // State aus einem Prop initialisieren → untrack(), sonst
  // state_referenced_locally-Warnung (s. CLAUDE.md Konventionen).
  let tags = $state<TagWithCount[]>(untrack(() => [...data.tags]));
  let newName = $state('');
  let busy = $state(false);
  let errorMsg = $state('');

  function sortByName(list: TagWithCount[]): TagWithCount[] {
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  async function addTag(e: Event) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;

    busy = true;
    errorMsg = '';
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name })
      });
      const result = await res.json();
      if (res.ok) {
        // Duplikat (case-insensitiv) nicht doppelt in die Liste legen.
        const exists = tags.some(
          (t) => t.name.toLowerCase() === name.toLowerCase() || t.id === result.id
        );
        if (!exists) tags = sortByName([...tags, { id: result.id, name, count: 0 }]);
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

  async function removeTag(id: number) {
    if (busy) return;
    busy = true;
    errorMsg = '';
    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        tags = tags.filter((t) => t.id !== id);
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
  <title>Tags – Koch-App</title>
</svelte:head>

<main class="container settings">
  <a href="/settings" class="back-link"><Icon name="back" size={16} /> Einstellungen</a>

  <p class="dim">
    Tags sind Querschnitts-Merkmale über Kategorien hinweg (z.&nbsp;B.
    „vegetarisch", „schnell", „für Gäste"). Sie lassen sich im Rezept-Formular
    setzen, die KI schlägt sie beim Erstellen vor — und in der Überschrift
    der Startseite danach filtern.
  </p>

  <section class="card">
    <form onsubmit={addTag} class="add-form">
      <input
        type="text"
        bind:value={newName}
        placeholder="z. B. vegetarisch"
        maxlength="40"
        autocomplete="off"
        aria-label="Neuer Tag"
      />
      <button type="submit" class="btn btn-primary" disabled={busy || !newName.trim()}>
        {busy ? '…' : 'Hinzufügen'}
      </button>
    </form>

    {#if errorMsg}<p class="err">{errorMsg}</p>{/if}

    {#if tags.length === 0}
      <p class="empty">
        <Icon name="info" size={16} />
        Noch keine Tags vorhanden. Leg welche an oder lass die KI welche setzen —
        sie erscheinen automatisch auch im Filter.
      </p>
    {:else}
      <ul class="chips">
        {#each tags as tag (tag.id)}
          <li class="chip">
            <span class="chip-name">{tag.name}</span>
            <span class="chip-count" title="Rezepte mit diesem Tag">{tag.count}</span>
            <button
              type="button"
              class="chip-remove"
              onclick={() => removeTag(tag.id)}
              disabled={busy}
              aria-label={`"${tag.name}" entfernen`}
            >
              <Icon name="close" size={14} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <p class="dim small">
    Tags gelten pro Rezept — auch Varianten können eigene haben. Beim Filtern
    zählt die ganze Rezept-Familie: Ein Rezept erscheint unter „vegetarisch",
    wenn irgendeine Version das Tag trägt.
  </p>
</main>

<style>
  .settings {
    padding-top: 16px;
  }
  .dim {
    color: var(--dim);
    margin-top: 14px;
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
  .chip-count {
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--surface-3);
    color: var(--text-dim);
    font-size: 0.78rem;
    font-weight: 600;
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
</style>
