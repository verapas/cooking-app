<script lang="ts">
  import type { Ingredient } from '$lib/types';
  import { formatIngredient } from '$lib/portion';

  let { ingredients, factor }: { ingredients: Ingredient[]; factor: number } = $props();
</script>

<ul class="inglist">
  {#each ingredients as ing (ing.id)}
    <li>{formatIngredient(ing, factor)}</li>
  {/each}
</ul>

<style>
  .inglist {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .inglist li {
    padding: 9px 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-variant-numeric: tabular-nums;
  }
</style>
