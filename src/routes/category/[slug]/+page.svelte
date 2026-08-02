<script lang="ts">
  import type { PageData } from './$types';
  import RecipeCard from '$lib/components/RecipeCard.svelte';
  import CategoryIcon from '$lib/components/CategoryIcon.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data }: { data: PageData } = $props();
  let searchQuery = $state('');

  function handleSearch() {
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  }
</script>

<svelte:head>
  <title>{data.category.name} – Koch-App</title>
</svelte:head>

<main class="container">
  <a href="/" class="back-link"><Icon name="back" size={16} /> Alle Rezepte</a>
  <header class="page-head">
    <div class="head-main">
      <h1>{#if data.category.icon}<CategoryIcon icon={data.category.icon} size={24} /> {/if}{data.category.name}</h1>
      <p class="sub">{data.recipes.length} Rezepte</p>
    </div>
    <form class="search-inline" onsubmit={(e) => { e.preventDefault(); handleSearch(); }}>
      <input
        bind:value={searchQuery}
        placeholder="In {data.category.name} suchen..."
        autocomplete="off"
      />
      <button type="submit" class="btn-icon-search" aria-label="Suchen"><Icon name="search" size={20} /></button>
    </form>
  </header>

  <section class="recipe-grid">
    {#each data.recipes as recipe (recipe.id)}
      <RecipeCard {recipe} />
    {:else}
      <p class="dim">Noch keine Rezepte in dieser Kategorie.</p>
    {/each}
  </section>
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
    display: flex;
    align-items: center;
    gap: 8px;
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
</style>
