<script lang="ts">
  import { untrack } from 'svelte';
  import type { PageData } from './$types';
  import RecipeCard from '$lib/components/RecipeCard.svelte';
  import { applyPinReorder } from '$lib/recipeOrder';

  let { data }: { data: PageData } = $props();

  // State aus einem Prop initialisieren → untrack() (s. CLAUDE.md).
  let recipes = $state(untrack(() => [...data.recipes]));

  // Pin live umsetzen (wie Hauptseite): Karte rutscht direkt nach oben.
  function handlePinChange(id: number, pinned: boolean): void {
    recipes = applyPinReorder(recipes, id, pinned);
  }
</script>

<svelte:head>
  <title>Koch-App – Favoriten</title>
</svelte:head>

<main class="container">
  <section class="recipe-grid" aria-label="Favoriten">
    {#each recipes as recipe (recipe.id)}
      <RecipeCard {recipe} onPinChange={handlePinChange} />
    {:else}
      <p class="dim">Noch keine Favoriten vorhanden.</p>
    {/each}
  </section>
</main>
