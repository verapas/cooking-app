<script lang="ts">
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import ChatPanel from '$lib/components/ChatPanel.svelte';

  let { data } = $props();

  // Nach erfolgreichem Speichern: zur Detailseite des (neuen) Rezepts.
  function onsaved(id: number) {
    goto(`/recipe/${id}`);
  }
</script>

<svelte:head>
  <title>{data.mode === 'improve' ? 'KI: Rezept verbessern' : 'Neues Rezept mit KI'} – Koch-App</title>
</svelte:head>

<main class="container chat-page">
  <header class="chat-header">
    <h1>
      <span class="h-ic"><Icon name="sparkles" size={24} /></span>
      {data.mode === 'improve'
        ? `KI: „${data.contextTitle}" verbessern`
        : 'Neues Rezept mit der KI planen'}
    </h1>
    {#if data.mode === 'improve'}
      <p class="dim small">
        Du überschreibst das Original oder legst eine neue Version an —
        wählbar beim Speichern.
      </p>
    {:else}
      <p class="dim small">
        Plane ein Rezept im Chat. Der Verlauf wird nicht gespeichert — nur
        das fertige Rezept am Ende.
      </p>
    {/if}
  </header>

  {#if !data.has_key}
    <div class="no-key">
      <Icon name="info" size={20} />
      <div>
        <p>Es ist noch kein API-Key hinterlegt.</p>
        <a href="/settings/ai" class="btn btn-primary btn-sm">Jetzt einrichten</a>
      </div>
    </div>
  {/if}

  <div class="chat-shell">
    <ChatPanel
      mode={data.mode}
      recipeId={data.recipeId}
      mainRecipeId={data.mainRecipeId}
      contextTitle={data.contextTitle}
      {onsaved}
    />
  </div>
</main>

<style>
  .chat-page {
    /* Füllt den Scroll-Container aus dem Layout (.app-scroll ist bereits
       viewport-56px hoch). Hier 100% statt calc(100vh-56px), sonst gäbe
       es doppelte Höhe. overflow hidden, damit nur die Nachrichtenliste
       intern scrollt. */
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 8px 16px 0; /* überschreibt .container (das 24px unten) */
    overflow: hidden;
  }
  .chat-header {
    flex-shrink: 0;
    padding-bottom: 8px;
  }
  .chat-header h1 {
    margin: 8px 0 2px;
    font-size: 1.25rem;
  }
  .dim {
    color: var(--dim);
  }
  .small {
    font-size: 0.88rem;
    margin-bottom: 10px;
  }
  .h-ic {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    color: var(--accent);
  }
  .no-key {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--warning, #e0a800);
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 12px;
    color: var(--warning, #e0a800);
  }
  .no-key p {
    margin: 0 0 8px;
    color: var(--text);
  }
  .btn-sm {
    padding: 6px 12px;
    font-size: 0.85rem;
  }
  .chat-shell {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
