<script lang="ts">
  import type { Ingredient, Step } from '$lib/types';
  import { formatIngredient } from '$lib/portion';
  import StepTimer from './StepTimer.svelte';
  import Icon from './Icon.svelte';

  let {
    steps,
    ingredients,
    factor
  }: {
    steps: Step[];
    ingredients: Ingredient[];
    factor: number;
  } = $props();

  let index = $state(0);
  let done = $state(false);

  let total = $derived(steps.length);
  let current = $derived(steps[index]);
  let stepIngredients = $derived(
    current ? ingredients.filter((i) => i.step_id === current.id) : []
  );
  let progress = $derived(total > 0 ? ((index + 1) / total) * 100 : 0);
  let isLast = $derived(index >= total - 1);

  function next(): void {
    if (isLast) {
      done = true;
      return;
    }
    index += 1;
  }
  function prev(): void {
    if (index > 0) index -= 1;
  }
  function restart(): void {
    index = 0;
    done = false;
  }
</script>

{#if done}
  <div class="finish">
    <p class="big"><Icon name="celebrate" size={56} /></p>
    <h2>Guten Appetit!</h2>
    <p class="dim">Das Rezept ist fertig zubereitet.</p>
    <button class="btn" onclick={restart}><Icon name="restart" size={18} /> Nochmal kochen</button>
  </div>
{:else if current}
  <div class="stepper">
    <div class="topbar">
      <span class="count">Schritt {index + 1} / {total}</span>
    </div>
    <div class="progressbar" role="progressbar" aria-valuenow={index + 1} aria-valuemax={total}>
      <div class="bar" style="width:{progress}%"></div>
    </div>

    <div class="stepcard">
      {#if current.duration_sec}
        <StepTimer durationSec={current.duration_sec} />
      {/if}

      {#if stepIngredients.length}
        <div class="ings">
          <ul>
            {#each stepIngredients as ing (ing.id)}
              <li>{formatIngredient(ing, factor)}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <p class="instruction">{current.instruction}</p>
    </div>

    <div class="nav">
      <button class="btn" onclick={prev} disabled={index === 0}><Icon name="back" size={18} /> Zurück</button>
      <button class="btn btn-primary" onclick={next}>
        {isLast ? 'Fertig' : 'Weiter'} <Icon name={isLast ? 'check' : 'forward'} size={18} />
      </button>
    </div>
  </div>
{/if}

<style>
  .finish {
    text-align: center;
    padding: 36px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-top: 18px;
  }
  .finish .big {
    color: var(--accent);
    margin: 0 0 4px;
  }
  .finish h2 {
    margin: 0 0 6px;
  }
  .stepper {
    margin-top: 18px;
  }
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .count {
    color: var(--text-dim);
    font-size: 0.9rem;
    font-weight: 600;
  }
  .progressbar {
    height: 6px;
    background: var(--surface-2);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 18px;
  }
  .bar {
    height: 100%;
    background: var(--accent);
    border-radius: 999px;
    transition: width 0.25s ease;
  }
  .stepcard {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px;
  }
  .ings {
    margin-bottom: 14px;
  }
  .ings ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ings li {
    padding: 9px 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-variant-numeric: tabular-nums;
  }
  .instruction {
    margin: 0;
    font-size: 1.08rem;
    line-height: 1.5;
  }
  .nav {
    display: flex;
    gap: 10px;
    margin-top: 18px;
  }
  .nav .btn {
    flex: 1;
  }
</style>
