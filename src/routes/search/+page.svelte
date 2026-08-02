<script lang="ts">
  import type { PageData } from './$types';
  import RecipeCard from '$lib/components/RecipeCard.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Suche – Koch-App</title>
</svelte:head>

<main class="container">
  <header class="page-head">
    <h1><span class="h-ic"><Icon name="search" size={24} /></span> Suche</h1>
  </header>

  <form method="GET" class="searchform" role="search">
    <input
      name="q"
      value={data.q}
      placeholder="Rezept oder Zutat…"
      autocomplete="off"
    />
    <button type="submit" class="btn btn-primary" aria-label="Suchen"><Icon name="forward" size={18} /></button>
  </form>

  {#if data.q.trim()}
    <p class="result-count">
      {data.results.length} Treffer für „{data.q}"
    </p>
    <section class="recipe-grid">
      {#each data.results as recipe (recipe.id)}
        <RecipeCard {recipe} />
      {:else}
        <p class="dim">Nichts gefunden.</p>
      {/each}
    </section>
  {:else}
    <p class="dim hint">Tippe einen Suchbegriff, z.&nbsp;B. „Tomate" oder „Pancakes".</p>
  {/if}
</main>

<style>
  .searchform {
    display: flex;
    gap: 8px;
    margin: 4px 0 8px;
  }
  .searchform input {
    flex: 1;
    min-height: var(--tap);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font-size: 1rem;
  }
  .searchform input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .searchform button {
    min-width: var(--tap);
  }
  .result-count {
    color: var(--text-dim);
    margin: 14px 0;
  }
  .hint {
    margin-top: 14px;
  }
  .h-ic {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
  }
</style>
