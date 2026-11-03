<script lang="ts">
  import Swal from 'sweetalert2';
  import { handleUnauthorized, readJson } from '$lib/api';
  import Icon from '$lib/components/Icon.svelte';
  import IngredientList from '$lib/components/IngredientList.svelte';
  import { formatDuration, formatIngredient } from '$lib/portion';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let busy = $state(false);

  const recipe = $derived(data.recipe);
  const totalMin = $derived((recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0));

  function fmtTime(m: number): string {
    if (m <= 0) return '';
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const r = m % 60;
      return r ? `${h}h ${r}m` : `${h}h`;
    }
    return `${m} Min.`;
  }

  function stepsIngredients(stepId: number) {
    return recipe.ingredients.filter((i) => i.step_id === stepId);
  }

  /** Kopiert das Rezept in den eigenen Space und bietet einen Direktlink an. */
  async function copyToMySpace() {
    if (busy) return;
    busy = true;
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/copy`, {
        method: 'POST',
        credentials: 'include'
      });
      if (handleUnauthorized(res)) return;
      const body = await readJson(res);
      if (!res.ok) {
        await Swal.fire({
          title: 'Kopieren fehlgeschlagen',
          text: body.error || (body.message as string) || 'Bitte später erneut versuchen.',
          icon: 'error',
          background: '#1f1a14',
          color: '#f5ede2',
          confirmButtonColor: '#ff7a3d'
        });
        return;
      }
      const result = await Swal.fire({
        title: 'Kopiert!',
        html: `„<strong>${recipe.title}</strong>“ liegt jetzt in deinem Space — als eigene,
          unveröffentlichte Kopie, die du frei bearbeiten kannst.`,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Rezept öffnen',
        cancelButtonText: 'Hier bleiben',
        background: '#1f1a14',
        color: '#f5ede2',
        confirmButtonColor: '#ff7a3d',
        cancelButtonColor: '#3a3024'
      });
      if (result.isConfirmed) window.location.href = `/recipe/${body.id}`;
    } catch {
      await Swal.fire({
        title: 'Kopieren fehlgeschlagen',
        text: 'Verbindungsfehler.',
        icon: 'error',
        background: '#1f1a14',
        color: '#f5ede2',
        confirmButtonColor: '#ff5c5c'
      });
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>{recipe.title} (öffentlich) – Koch-App</title>
</svelte:head>

<main class="container detail">
  <a href="/public" class="back-link"><Icon name="back" size={16} /> Öffentlich</a>

  <article class="detail-card">
    {#if recipe.image_url}
      <div class="hero">
        <img src={recipe.image_url} alt={recipe.title} />
      </div>
    {:else}
      <div class="hero hero-empty"><Icon name="image" size={48} /></div>
    {/if}

    <div class="card-body">
      <p class="by">
        <Icon name="globe" size={14} />
        Veröffentlicht von {recipe.author_label ?? 'Unbekannt'}
      </p>
      <h1>{recipe.title}</h1>
      {#if recipe.description}<p class="desc">{recipe.description}</p>{/if}

      {#if recipe.tags.length > 0}
        <div class="recipe-tags" aria-label="Tags">
          {#each recipe.tags as tagName (tagName)}
            <span class="recipe-tag"><Icon name="tag" size={12} /> {tagName}</span>
          {/each}
        </div>
      {/if}

      <p class="meta">
        {#if recipe.category}{recipe.category.name} · {/if}
        {recipe.base_servings} Portionen
        {#if fmtTime(totalMin)}· {fmtTime(totalMin)}{/if}
        {#if recipe.source}· Quelle: {recipe.source}{/if}
      </p>

      <button type="button" class="btn btn-primary copy-btn" onclick={copyToMySpace} disabled={busy}>
        <Icon name="book" size={18} />
        {busy ? 'Kopiere…' : 'In meinen Space kopieren'}
      </button>
    </div>
  </article>

  <section class="block">
    <h2 class="block-h"><Icon name="cart" size={20} /> Zutaten</h2>
    <IngredientList ingredients={recipe.ingredients} factor={1} />
  </section>

  <section class="block">
    <h2 class="block-h"><Icon name="chef" size={20} /> Zubereitung</h2>
    <ol class="steps">
      {#each recipe.steps as step (step.id)}
        <li class="step">
          <div class="step-head">
            <span class="stepnum">{step.order}</span>
            {#if step.duration_sec}
              <span class="timer-badge"><Icon name="timer" size={14} /> {formatDuration(step.duration_sec)}</span>
            {/if}
          </div>
          {#if stepsIngredients(step.id).length}
            <ul class="step-ings">
              {#each stepsIngredients(step.id) as ing (ing.id)}
                <li>{formatIngredient(ing, 1)}</li>
              {/each}
            </ul>
          {/if}
          <p class="step-text">{step.instruction}</p>
        </li>
      {/each}
    </ol>
  </section>
</main>

<style>
  .detail-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .card-body {
    padding: 16px 16px 18px;
  }
  .hero {
    aspect-ratio: 16 / 10;
    background: var(--surface-2);
  }
  .hero img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .hero-empty {
    display: grid;
    place-items: center;
    color: var(--dim);
  }
  .by {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--accent);
    font-size: 0.85rem;
    margin: 0 0 6px;
  }
  h1 {
    margin: 0 0 6px;
  }
  .desc {
    color: var(--text-dim);
    margin: 0 0 10px;
  }
  .recipe-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 10px;
  }
  .recipe-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-dim);
    font-size: 0.8rem;
  }
  .meta {
    color: var(--dim);
    font-size: 0.88rem;
    margin: 0 0 14px;
  }
  .copy-btn {
    width: 100%;
    min-height: var(--tap);
    justify-content: center;
  }
  .block {
    margin-top: 18px;
  }
  .block-h {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.05rem;
    margin: 0 0 10px;
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .step {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
  }
  .step-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .stepnum {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: var(--surface-3);
    color: var(--text-dim);
    font-size: 0.85rem;
    font-weight: 600;
    flex-shrink: 0;
  }
  .timer-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border-radius: 999px;
    background: rgba(255, 122, 61, 0.12);
    color: var(--accent);
    font-size: 0.78rem;
    font-weight: 600;
  }
  .step-ings {
    margin: 0 0 6px;
    padding-left: 18px;
    color: var(--text-dim);
    font-size: 0.9rem;
  }
  .step-text {
    margin: 0;
    line-height: 1.55;
  }
</style>
