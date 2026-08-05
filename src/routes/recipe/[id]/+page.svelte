<script lang="ts">
  import { untrack } from 'svelte';
  import type { PageData } from './$types';
  import PortionControls from '$lib/components/PortionControls.svelte';
  import IngredientList from '$lib/components/IngredientList.svelte';
  import Stepper from '$lib/components/Stepper.svelte';
  import CategoryIcon from '$lib/components/CategoryIcon.svelte';
  import { formatDuration, formatIngredient, scaleFactor } from '$lib/portion';
  import Swal from 'sweetalert2';
  import Icon from '$lib/components/Icon.svelte';

  let { data }: { data: PageData } = $props();

  let servings = $state(untrack(() => data.recipe.base_servings));
  let mode = $state<'classic' | 'stepper'>('classic');
  let imageUrl = $state(untrack(() => data.imageUrl));
  let selectedVersionId = $state(untrack(() => data.recipe.id));
  let uploadBusy = $state(false);
  let uploadError = $state('');
  let versionDropdownOpen = $state(false);

  // Dropdown schließen bei Klick außerhalb
  $effect(() => {
    if (!versionDropdownOpen) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.version-dropdown')) versionDropdownOpen = false;
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  });

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

  async function onImageChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    uploadBusy = true;
    uploadError = '';
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`/api/recipes/${recipe.id}/image`, { method: 'POST', body: fd });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        uploadError = 'Upload fehlgeschlagen' + (data.error ? ': ' + data.error : '');
      } else {
        const data = (await res.json()) as { image_url: string };
        imageUrl = data.image_url;
      }
    } catch {
      uploadError = 'Verbindungsfehler.';
    } finally {
      uploadBusy = false;
      input.value = '';
    }
  }

    async function deleteRecipe() {
    const result = await Swal.fire({
      title: 'Rezept löschen?',
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
  <a href="/" class="back-link"><Icon name="back" size={16} /> Rezepte</a>

  {#if imageUrl}
    <div class="hero">
      <img src={imageUrl} alt={recipe.title} />
      <button class="hero-upload" onclick={() => document.getElementById('image-input')?.click()} disabled={uploadBusy} aria-label="Bild ändern">
        <Icon name="camera" size={18} />
      </button>
    </div>
    <input id="image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange={onImageChange} hidden />
  {:else}
    <div class="hero hero-empty">
      <Icon name="image" size={48} />
      <button class="hero-upload" onclick={() => document.getElementById('image-input')?.click()} disabled={uploadBusy} aria-label="Bild hochladen">
        <Icon name="camera" size={18} />
      </button>
    </div>
    <input id="image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange={onImageChange} hidden />
  {/if}

  {#if recipe.category}
    <a class="catchip-top" href="/category/{recipe.category.slug}">
      <CategoryIcon icon={recipe.category.icon} size={16} /> {recipe.category.name}
    </a>
  {/if}

  <h1>{recipe.title}</h1>
  {#if recipe.description}<p class="desc">{recipe.description}</p>{/if}

  {#if uploadError}<p class="err">{uploadError}</p>{/if}

  <div class="toolbar">
    {#if hasVersions}
      <div class="version-dropdown">
        <button class="version-trigger" onclick={() => versionDropdownOpen = !versionDropdownOpen}>
          <Icon name="branch" size={18} />
          <span>{data.versions.find(v => v.id === selectedVersionId)?.version_name || (data.versions.find(v => v.id === selectedVersionId)?.is_main ? 'Standard' : 'Variante')}</span>
          <Icon name="chevron-down" size={14} class={versionDropdownOpen ? 'rotated' : ''} />
        </button>
        {#if versionDropdownOpen}
          <div class="version-menu" role="listbox">
            {#each data.versions as version (version.id)}
              <button
                class="version-option"
                class:active={version.id === selectedVersionId}
                role="option"
                onclick={() => { changeVersion(version.id); versionDropdownOpen = false; }}
              >
                {version.version_name || (version.is_main ? 'Standard' : `Variante #${version.id}`)}
                {#if version.is_main}<span class="tag">Haupt</span>{/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <div class="actions-right">
      <a href="/recipe/{recipe.id}/edit" class="btn-icon-small" aria-label="Bearbeiten">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </a>
      <a
        href="/chat?recipe={recipe.id}"
        class="btn-icon-small btn-ai"
        aria-label="Mit KI verbessern oder neue Version"
        title="Mit KI verbessern / neue Version"
      >
        <Icon name="sparkles" size={18} />
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
      <Icon name="book" size={18} /> Klassisch
    </button>
    <button
      class="btn"
      class:active={mode === 'stepper'}
      onclick={() => (mode = 'stepper')}
      role="tab"
      aria-selected={mode === 'stepper'}
    >
      <Icon name="list" size={18} /> Schritt für Schritt
    </button>
  </div>

  {#if mode === 'classic'}
    <section class="block">
      <h2 class="block-h"><Icon name="cart" size={20} /> Zutaten</h2>
      <IngredientList ingredients={allIngredients} {factor} />
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
    position: relative;
  }
  .hero img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .hero-upload {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface) 80%, transparent);
    color: var(--text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    backdrop-filter: blur(4px);
  }
  .hero-upload:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--surface) 95%, transparent);
  }
  .hero-upload:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .hero-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-faint);
  }
  .hero-empty .hero-upload {
    position: absolute;
    top: 8px;
    right: 8px;
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
  .version-trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: var(--tap);
  }
  .version-trigger:hover {
    border-color: var(--accent);
  }
  .version-trigger :global(.rotated) {
    transform: rotate(180deg);
    transition: transform 0.2s ease;
  }
  .version-trigger :global(svg) {
    transition: transform 0.2s ease;
  }
  .version-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 100%;
    z-index: 50;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    animation: dropdownIn 0.15s ease;
  }
  @keyframes dropdownIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .version-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text);
    font-size: 0.9rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s ease;
  }
  .version-option:hover {
    background: var(--surface-2);
  }
  .version-option.active {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
    font-weight: 600;
  }
  .version-option .tag {
    margin-left: auto;
    font-size: 0.7rem;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--surface-3);
    color: var(--text-dim);
    font-weight: 400;
  }
  .version-option.active .tag {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
    color: var(--accent);
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
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .block-h {
    display: flex;
    align-items: center;
    gap: 8px;
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
    display: inline-flex;
    align-items: center;
    gap: 4px;
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

  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 0;
    flex-wrap: wrap;
  }
  .version-dropdown {
    position: relative;
    flex: 1;
  }

  .actions-right {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .err {
    color: var(--danger);
    font-size: 0.85rem;
    margin: 0 0 4px;
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

  .btn-icon-small.btn-ai {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 10%, var(--surface-2));
  }

  .btn-icon-small.btn-ai:hover {
    background: color-mix(in srgb, var(--accent) 18%, var(--surface-2));
  }
</style>
