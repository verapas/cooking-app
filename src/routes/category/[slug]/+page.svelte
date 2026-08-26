<script lang="ts">
  import { untrack } from 'svelte';
  import type { PageData } from './$types';
  import RecipeCard from '$lib/components/RecipeCard.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data }: { data: PageData } = $props();
  let searchQuery = $state('');

  // Lokale Liste für die Live-Suche; bleibt bei Kategoriewechsel
  // (gleiche Route, anderer Slug aus dem Drawer) mit dem Server-Load synchron.
  let recipes = $state(untrack(() => [...data.recipes]));
  let activeQuery = $state('');
  let searching = $state(false);

  $effect(() => {
    void data.category.id;
    untrack(() => {
      recipes = [...data.recipes];
      searchQuery = '';
      activeQuery = '';
    });
  });

  // Live-Suche innerhalb der Kategorie über die REST-API (keine Extra-Seite).
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
      const res = await fetch(
        `/api/recipes?category_id=${data.category.id}&q=${encodeURIComponent(q)}`
      );
      if (res.ok) {
        recipes = await res.json();
        activeQuery = q;
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
  }
</script>

<svelte:head>
  <title>{data.category.name} – Koch-App</title>
</svelte:head>

<main class="container">
  <header class="page-head">
    <form class="search-inline" onsubmit={(e) => { e.preventDefault(); void runSearch(); }}>
      <input
        bind:value={searchQuery}
        placeholder="In {data.category.name} suchen..."
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

  <section class="recipe-grid">
    {#each recipes as recipe (recipe.id)}
      <RecipeCard {recipe} />
    {:else}
      <p class="dim">{activeQuery ? 'Nichts gefunden.' : 'Noch keine Rezepte in dieser Kategorie.'}</p>
    {/each}
  </section>
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
</style>
