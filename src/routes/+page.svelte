<script lang="ts">
  import type { PageData } from './$types';
  import RecipeCard from '$lib/components/RecipeCard.svelte';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Koch-App – Rezepte</title>
</svelte:head>

<main class="container">
  <header class="page-head">
    <h1>Alle Rezepte</h1>
    <p class="sub">{data.recipes.length} Rezepte · ☰ Menü für Kategorien</p>
  </header>

  <section class="recipe-grid" aria-label="Rezepte">
    {#each data.recipes as recipe (recipe.id)}
      <RecipeCard {recipe} />
    {:else}
      <p class="dim">Noch keine Rezepte vorhanden.</p>
    {/each}
  </section>
</main>
