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
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  }
</script>

<svelte:head>
  <title>Koch-App – Rezepte</title>
</svelte:head>

<main class="container">
  <header class="page-head">
    <div class="head-main">
      <h1>Alle Rezepte</h1>
      <p class="sub">{recipes.length}{hasMore ? '+' : ''} Rezepte</p>
    </div>
    <form class="search-inline" onsubmit={(e) => { e.preventDefault(); handleSearch(); }}>
      <input
        bind:value={searchQuery}
        placeholder="Rezept suchen..."
        autocomplete="off"
      />
      <button type="submit" class="btn-icon-search" aria-label="Suchen"><Icon name="search" size={20} /></button>
    </form>
  </header>

  <section class="recipe-grid" aria-label="Rezepte">
    {#each recipes as recipe (recipe.id)}
      <RecipeCard {recipe} />
    {:else}
      <p class="dim">Noch keine Rezepte vorhanden.</p>
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
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
  }
  .head-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .page-head h1 {
    font-size: 1.6rem;
    margin: 0;
  }
  .sub {
    color: var(--text-dim);
    margin: 0;
  }
  .search-inline {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }
  .search-inline input {
    min-width: 120px;
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
