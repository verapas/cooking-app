<script lang="ts">
  import { untrack } from 'svelte';
  import type { PageData } from './$types';
  import PortionControls from '$lib/components/PortionControls.svelte';
  import IngredientList from '$lib/components/IngredientList.svelte';
  import Stepper from '$lib/components/Stepper.svelte';
  import ImageUpload from '$lib/components/ImageUpload.svelte';
  import { formatDuration, formatIngredient, scaleFactor } from '$lib/portion';
  import type { RecipeVersion } from '$lib/types';
  import Swal from 'sweetalert2';

  let { data }: { data: PageData } = $props();

  let servings = $state(untrack(() => data.recipe.base_servings));
  let mode = $state<'classic' | 'stepper'>('classic');
  let imageUrl = $state(untrack(() => data.recipe.image_url));
  let selectedVersionId = $state(untrack(() => data.recipe.id));

  let recipe = $derived(data.recipe);
  let factor = $derived(scaleFactor(recipe.base_servings, servings));
  let allIngredients = $derived(recipe.ingredients);
  let totalMin = $derived((recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0));
  let hasVersions = $derived(data.versions.length > 1);

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
  function changeVersion(versionId: number) {
    selectedVersionId = versionId;
    window.location.href = `/recipe/${versionId}`;
  }

  async function deleteRecipe() {
    const result = await Swal.fire({
      title: '⚠️ Rezept löschen?',
      text: `Möchtest du "${recipe.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff5c5c',
      cancelButtonColor: '#3a3024',
      confirmButtonText: 'Ja, löschen',
      cancelButtonText: 'Abbrechen',
      background: '#1f1a14',
      color: '#f5ede2'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/recipes/${recipe.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (res.ok) {
          await Swal.fire({
            title: 'Gelöscht!',
            text: 'Das Rezept wurde erfolgreich gelöscht.',
            icon: 'success',
            background: '#1f1a14',
            color: '#f5ede2',
            confirmButtonColor: '#ff7a3d'
          });
          window.location.href = '/';
        }
      } catch (error) {
        await Swal.fire({
          title: 'Fehler!',
          text: 'Beim Löschen ist ein Fehler aufgetreten.',
          icon: 'error',
          background: '#1f1a14',
          color: '#f5ede2',
          confirmButtonColor: '#ff5c5c'
        });
      }
    }
  }
</script>

<svelte:head>
  <title>{recipe.version_name ? `${recipe.title} (${recipe.version_name})` : recipe.title} – Koch-App</title>
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

  {#if hasVersions}
    <div class="version-selector">
      <label for="version-select">Version:</label>
      <select id="version-select" bind:value={selectedVersionId} onchange={(e) => {
        const target = e.target as HTMLSelectElement;
        changeVersion(Number(target.value));
      }}>
        {#each data.versions as version (version.id)}
          <option value={version.id}>
            {version.version_name || (version.is_main ? 'Standard' : `Variante #${version.id}`)}
            {version.is_main ? ' (Haupt)' : ''}
          </option>
        {/each}
      </select>
    </div>
  {/if}

  <div class="image-actions">
    <div class="upload-left">
      <ImageUpload recipeId={recipe.id} onUploaded={(u) => (imageUrl = u)} />
    </div>

    <div class="actions-right">
      <a href="/recipe/{recipe.id}/edit" class="btn-icon-small" aria-label="Bearbeiten">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </a>
      <button class="btn-icon-small btn-danger" onclick={deleteRecipe} aria-label="Löschen">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"/>
          <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/>
        </svg>
      </button>
    </div>
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
  .version-selector {
    margin: 12px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .version-selector label {
    font-size: 0.9rem;
    color: var(--text-dim);
  }
  .version-selector select {
    padding: 6px 10px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 0.9rem;
    min-width: 150px;
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

  .image-actions {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin: 14px 0;
  }

  .upload-left {
    flex: 1;
  }

  .upload-left :global(.upload) {
    margin: 0;
  }

  .actions-right {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-icon-small {
    width: 40px;
    height: 40px;
    min-height: 40px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-icon-small:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .btn-icon-small.btn-danger {
    color: var(--danger);
    border-color: rgba(255, 92, 92, 0.3);
  }

  .btn-icon-small.btn-danger:hover {
    border-color: var(--danger);
  }
</style>
