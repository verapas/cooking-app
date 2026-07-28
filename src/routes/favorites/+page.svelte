<script lang="ts">
  import type { PageData } from './$types';
  import RecipeCard from '$lib/components/RecipeCard.svelte';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Koch-App – Favoriten</title>
</svelte:head>

<main class="container">
  <header class="page-head">
    <h1>⭐ Favoriten</h1>
    <p class="sub">{data.recipes.length} gespeicherte Rezepte</p>
  </header>

  <section class="recipe-grid" aria-label="Favoriten">
    {#each data.recipes as recipe (recipe.id)}
      <RecipeCard {recipe} />
    {:else}
      <p class="dim">Noch keine Favoriten vorhanden.</p>
    {/each}
  </section>
</main>