<script lang="ts">
  import { untrack } from 'svelte';
  import type { PageData } from './$types';
  import RecipeCard from '$lib/components/RecipeCard.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data }: { data: PageData } = $props();
  let searchQuery = $state('');

  // „Mehr laden": Liste startet mit den ersten 30 aus dem Server-Load,
  // weitere 30 werden per Klick über die REST-API nachgeladen.
  // State aus einem Prop initialisieren → untrack() (s. CLAUDE.md).
  const PAGE_SIZE = 30;
  let recipes = $state(untrack(() => [...data.recipes]));
  let hasMore = $state(untrack(() => data.recipes.length === PAGE_SIZE));
  let loadingMore = $state(false);

  // Live-Suche: filtert über die REST-API direkt in dieser Liste
  // (keine extra Suchseite mehr). activeQuery =Suche gerade aktiv.
  let activeQuery = $state('');
  let searching = $state(false);

  async function runSearch(): Promise<void> {
    const q = searchQuery.trim();
    if (!q) {
      // Leeres Suchfeld + aktive Suche absenden → zurück zur Gesamtliste
      if (activeQuery) clearSearch();
      return;
    }
    if (searching) return;
    searching = true;
    try {
      const res = await fetch(`/api/recipes?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        recipes = await res.json();
        activeQuery = q;
        hasMore = false;
      }
    } catch {
      // Netzwerkfehler: Liste unverändert, User kann es erneut versuchen.
    } finally {
      searching = false;
    }
  }

  function clearSearch(): void {
    searchQuery = '';
    activeQuery = '';
    recipes = [...data.recipes];
    hasMore = data.recipes.length === PAGE_SIZE;
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    try {
      const res = await fetch(`/api/recipes?limit=${PAGE_SIZE}&offset=${recipes.length}`);
      if (res.ok) {
        const more = await res.json();
        recipes = [...recipes, ...more];
        // kamen wieder genau PAGE_SIZE, könnte es noch mehr geben
        hasMore = Array.isArray(more) && more.length === PAGE_SIZE;
      }
    } catch {
      // Netzwerkfehler: Button bleibt, User kann es erneut versuchen.
    } finally {
      loadingMore = false;
    }
  }

  function handleSearch() {
    void runSearch();
  }
</script>

<svelte:head>
  <title>Koch-App – Rezepte</title>
</svelte:head>

<main class="container">
  <header class="page-head">
    <form class="search-inline" onsubmit={(e) => { e.preventDefault(); handleSearch(); }}>
      <input
        bind:value={searchQuery}
        placeholder="Rezept suchen..."
        autocomplete="off"
      />
      {#if activeQuery}
        <button type="button" class="btn-icon-search" onclick={clearSearch} aria-label="Suche zurücksetzen"><Icon name="close" size={20} /></button>
      {/if}
      <button type="submit" class="btn-icon-search" aria-label="Suchen" disabled={searching}><Icon name="search" size={20} /></button>
    </form>
  </header>

  {#if activeQuery}
    <p class="result-info">{recipes.length} Treffer für „{activeQuery}"</p>
  {/if}

  <section class="recipe-grid" aria-label="Rezepte">
    {#each recipes as recipe (recipe.id)}
      <RecipeCard {recipe} />
    {:else}
      <p class="dim">{activeQuery ? 'Nichts gefunden.' : 'Noch keine Rezepte vorhanden.'}</p>
    {/each}
  </section>

  {#if hasMore}
    <div class="load-more">
      <button type="button" class="btn load-more-btn" onclick={loadMore} disabled={loadingMore}>
        {loadingMore ? 'Lädt…' : 'Mehr laden'}
      </button>
    </div>
  {/if}
</main>

<style>
  .page-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
  }
  .search-inline {
    display: flex;
    gap: 6px;
    width: 100%;
  }
  .search-inline input {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font-size: 0.9rem;
  }
  .search-inline input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .result-info {
    color: var(--text-dim);
    margin: 0 0 14px;
  }
  .btn-icon-search {
    min-width: var(--tap);
    min-height: var(--tap);
    width: var(--tap);
    height: var(--tap);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-dim);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }
  .btn-icon-search:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .load-more {
    display: flex;
    justify-content: center;
    margin-top: 16px;
  }
  .load-more-btn {
    min-height: var(--tap);
    padding: 10px 24px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 0.95rem;
  }
  .load-more-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .load-more-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
