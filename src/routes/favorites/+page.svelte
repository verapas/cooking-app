<script lang="ts">
  import type { PageData } from './$types';
  import RecipeCard from '$lib/components/RecipeCard.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Koch-App – Favoriten</title>
</svelte:head>

<main class="container">
  <header class="page-head">
    <h1><span class="h-ic"><Icon name="star" size={24} /></span> Favoriten</h1>
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

<style>
  .h-ic {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
  }
</style>