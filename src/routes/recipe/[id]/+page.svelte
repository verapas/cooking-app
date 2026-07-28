<script lang="ts">
  import { untrack } from 'svelte';
  import type { PageData } from './$types';
  import PortionControls from '$lib/components/PortionControls.svelte';
  import IngredientList from '$lib/components/IngredientList.svelte';
  import Stepper from '$lib/components/Stepper.svelte';
  import ImageUpload from '$lib/components/ImageUpload.svelte';
  import { formatDuration, formatIngredient, scaleFactor } from '$lib/portion';

  let { data }: { data: PageData } = $props();

  let servings = $state(untrack(() => data.recipe.base_servings));
  let mode = $state<'classic' | 'stepper'>('classic');
  let imageUrl = $state(untrack(() => data.recipe.image_url));

  let recipe = $derived(data.recipe);
  let factor = $derived(scaleFactor(recipe.base_servings, servings));
  let allIngredients = $derived(recipe.ingredients);
  let totalMin = $derived((recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0));

  function stepsIngredients(stepId: number) {
    return recipe.ingredients.filter((i) => i.step_id === stepId);
  }
  function fmtTime(m: number | null): string {
    if (!m || m <= 0) return '';
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const r = m % 60;
      return r ? `${h}h ${r}m` : `${h}h`;
    }
    return `${m} Min.`;
  }
</script>

<svelte:head>
  <title>{recipe.title} – Koch-App</title>
</svelte:head>

<main class="container detail">
  <a href="/" class="back-link">← Rezepte</a>

  {#if imageUrl}
    <div class="hero">
      <img src={imageUrl} alt={recipe.title} />
    </div>
  {/if}

  {#if recipe.category}
    <a class="catchip-top" href="/category/{recipe.category.slug}">
      {recipe.category.icon ?? ''} {recipe.category.name}
    </a>
  {/if}

  <h1>{recipe.title}</h1>
  {#if recipe.description}<p class="desc">{recipe.description}</p>{/if}

  <ImageUpload recipeId={recipe.id} onUploaded={(u) => (imageUrl = u)} />

  <div class="meta">
    {#if recipe.prep_time_min}<span>🔪 {fmtTime(recipe.prep_time_min)} Prep</span>{/if}
    {#if recipe.cook_time_min}<span>🔥 {fmtTime(recipe.cook_time_min)} Kochen</span>{/if}
    {#if totalMin > 0}<span>⏱ {fmtTime(totalMin)} gesamt</span>{/if}
  </div>

  <PortionControls baseServings={recipe.base_servings} bind:servings />

  <div class="modeswitch" role="tablist" aria-label="Ansicht">
    <button
      class="btn"
      class:active={mode === 'classic'}
      onclick={() => (mode = 'classic')}
      role="tab"
      aria-selected={mode === 'classic'}
    >
      📖 Klassisch
    </button>
    <button
      class="btn"
      class:active={mode === 'stepper'}
      onclick={() => (mode = 'stepper')}
      role="tab"
      aria-selected={mode === 'stepper'}
    >
      👆 Schritt für Schritt
    </button>
  </div>

  {#if mode === 'classic'}
    <section class="block">
      <h2>🛒 Zutaten</h2>
      <IngredientList ingredients={allIngredients} {factor} />
    </section>

    <section class="block">
      <h2>👩‍🍳 Zubereitung</h2>
      <ol class="steps">
        {#each recipe.steps as step (step.id)}
          <li class="step">
            <div class="step-head">
              <span class="stepnum">{step.order}</span>
              {#if step.duration_sec}
                <span class="timer-badge">⏱ {formatDuration(step.duration_sec)}</span>
              {/if}
            </div>
            {#if stepsIngredients(step.id).length}
              <ul class="step-ings">
                {#each stepsIngredients(step.id) as ing (ing.id)}
                  <li>{formatIngredient(ing, factor)}</li>
                {/each}
              </ul>
            {/if}
            <p class="step-text">{step.instruction}</p>
          </li>
        {/each}
      </ol>
    </section>
  {:else}
    <Stepper steps={recipe.steps} ingredients={recipe.ingredients} {factor} />
  {/if}
</main>

<style>
  .hero {
    margin: 8px 0 4px;
    border-radius: var(--radius);
    overflow: hidden;
    aspect-ratio: 16 / 10;
    background: var(--surface-2);
  }
  .hero img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .detail h1 {
    font-size: 1.7rem;
    margin-top: 6px;
  }
  .catchip-top {
    display: inline-block;
    font-size: 0.8rem;
    color: var(--accent);
    margin-top: 8px;
  }
  .desc {
    color: var(--text-dim);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    color: var(--text-dim);
    font-size: 0.9rem;
    margin: 8px 0 4px;
  }
  .modeswitch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 18px 0 4px;
  }
  .modeswitch .btn.active {
    background: var(--accent);
    color: var(--accent-contrast);
    border-color: var(--accent);
    font-weight: 600;
  }
  .block {
    margin-top: 22px;
  }
  .block h2 {
    font-size: 1.15rem;
  }
  .steps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .step {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
  }
  .step-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .stepnum {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 700;
    font-size: 0.9rem;
    flex-shrink: 0;
  }
  .timer-badge {
    font-size: 0.8rem;
    color: var(--text-dim);
    background: var(--surface-2);
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
  }
  .step-ings {
    margin: 0 0 8px;
    padding-left: 18px;
    color: var(--text-dim);
    font-size: 0.92rem;
  }
  .step-ings li {
    margin: 2px 0;
    font-variant-numeric: tabular-nums;
  }
  .step-text {
    margin: 0;
  }
</style>
