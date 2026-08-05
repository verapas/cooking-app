<script lang="ts">
  import type { Ingredient } from '$lib/types';
  import { formatIngredient } from '$lib/portion';
  import Icon from './Icon.svelte';

  let { ingredients, factor }: { ingredients: Ingredient[]; factor: number } = $props();

  let checked = $state<Set<number>>(new Set());

  function toggle(id: number) {
    if (checked.has(id)) {
      checked.delete(id);
    } else {
      checked.add(id);
    }
    checked = new Set(checked); // Trigger reactivity
  }
</script>

<ul class="inglist">
  {#each ingredients as ing (ing.id)}
    <li class:done={checked.has(ing.id)} onclick={() => toggle(ing.id)}>
      <span class="check">
        {#if checked.has(ing.id)}
          <Icon name="check" size={18} />
        {/if}
      </span>
      <span class="txt">{formatIngredient(ing, factor)}</span>
    </li>
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
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: opacity 0.2s ease, background 0.2s ease;
    user-select: none;
    -webkit-user-select: none;
  }
  .inglist li:hover {
    background: var(--surface-3);
  }
  .inglist li.done {
    opacity: 0.45;
  }
  .inglist li.done .txt {
    text-decoration: line-through;
  }
  .check {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
    color: transparent;
  }
  .inglist li.done .check {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }
  .txt {
    flex: 1;
    min-width: 0;
  }
</style>
