<script lang="ts">
  import type { PageData } from './$types';
  import RecipeCard from '$lib/components/RecipeCard.svelte';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.category.name} – Koch-App</title>
</svelte:head>

<main class="container">
  <a href="/" class="back-link">← Alle Rezepte</a>
  <header class="page-head">
    <h1>{#if data.category.icon}{data.category.icon} {/if}{data.category.name}</h1>
    <p class="sub">{data.recipes.length} Rezepte</p>
  </header>

  <section class="recipe-grid">
    {#each data.recipes as recipe (recipe.id)}
      <RecipeCard {recipe} />
    {:else}
      <p class="dim">Noch keine Rezepte in dieser Kategorie.</p>
    {/each}
  </section>
</main>
