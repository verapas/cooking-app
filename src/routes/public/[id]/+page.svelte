<script lang="ts">
  import { untrack } from 'svelte';
  import { swalFire } from '$lib/swal';
  import { handleUnauthorized, readJson } from '$lib/api';
  import Icon from '$lib/components/Icon.svelte';
  import IngredientList from '$lib/components/IngredientList.svelte';
  import PortionControls from '$lib/components/PortionControls.svelte';
  import Stepper from '$lib/components/Stepper.svelte';
  import { formatDuration, formatIngredient, scaleFactor } from '$lib/portion';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let busy = $state(false);
  // State aus einem Prop initialisieren → untrack() (s. CLAUDE.md).
  let servings = $state(untrack(() => data.recipe.base_servings));
  let mode = $state<'classic' | 'stepper'>('classic');
  let selectedVersionId = $state(untrack(() => data.recipe.id));
  let versionDropdownOpen = $state(false);

  // Dropdown schließen bei Klick außerhalb (wie Detailseite)
  $effect(() => {
    if (!versionDropdownOpen) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.version-dropdown')) versionDropdownOpen = false;
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  });

  const recipe = $derived(data.recipe);
  const factor = $derived(scaleFactor(recipe.base_servings, servings));
  const totalMin = $derived((recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0));
  const hasVersions = $derived(data.versions.length > 1);

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

  function changeVersion(versionId: number) {
    selectedVersionId = versionId;
    window.location.href = `/public/${versionId}`;
  }

  /** Importiert das Rezept in den eigenen Space und bietet einen Direktlink an. */
  async function importToMySpace() {
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
        await swalFire({
          title: 'Import fehlgeschlagen',
          text: body.error || (body.message as string) || 'Bitte später erneut versuchen.',
          icon: 'error',
          confirmButtonColor: 'var(--danger)'
        });
        return;
      }
      const result = await swalFire({
        title: 'Importiert!',
        html: `„<strong>${recipe.title}</strong>“ liegt jetzt in deinem Space — als eigene,
          unveröffentlichte Kopie, die du frei bearbeiten kannst.`,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Rezept öffnen',
        cancelButtonText: 'Hier bleiben',
      });
      if (result.isConfirmed) window.location.href = `/recipe/${body.id}`;
    } catch {
      await swalFire({
        title: 'Import fehlgeschlagen',
        text: 'Verbindungsfehler.',
        icon: 'error',
        confirmButtonColor: 'var(--danger)'
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

  <!--
    Gleiche Karten-Struktur wie die eigene Rezept-Detailseite: Foto,
    Einordnung, Portionen, Ansichts-Umschalter — nur schreibgeschützt
    und mit „Importieren" statt dem Aktions-Menü im Footer.
  -->
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
        {#if fmtTime(totalMin)}{fmtTime(totalMin)} · {/if}
        {#if recipe.source}Quelle: {recipe.source}{/if}
      </p>

      <PortionControls baseServings={recipe.base_servings} bind:servings />

      <div class="modeswitch" role="tablist" aria-label="Ansicht">
        <button
          type="button"
          class="seg-btn"
          class:active={mode === 'classic'}
          onclick={() => (mode = 'classic')}
          role="tab"
          aria-selected={mode === 'classic'}
        >
          <Icon name="book" size={18} /> Klassisch
        </button>
        <button
          type="button"
          class="seg-btn"
          class:active={mode === 'stepper'}
          onclick={() => (mode = 'stepper')}
          role="tab"
          aria-selected={mode === 'stepper'}
        >
          <Icon name="list" size={18} /> Schritt für Schritt
        </button>
      </div>
    </div>

    <div class="card-actions">
      {#if hasVersions}
        <div class="version-dropdown">
          <button class="version-trigger" onclick={() => versionDropdownOpen = !versionDropdownOpen}>
            <Icon name="branch" size={16} />
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
                  aria-selected={version.id === selectedVersionId}
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

      <button
        type="button"
        class="import-btn"
        onclick={importToMySpace}
        disabled={busy}
        title="Als Kopie in deinen Space übernehmen"
      >
        <Icon name="forward" size={16} />
        {busy ? 'Importiere…' : 'Importieren'}
      </button>
    </div>
  </article>

  {#if mode === 'classic'}
    <section class="block">
      <h2 class="block-h"><Icon name="cart" size={20} /> Zutaten</h2>
      <IngredientList ingredients={recipe.ingredients} {factor} />
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
  /* === Die große Rezept-Karte (wie eigene Detailseite) === */
  .detail-card {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .card-body {
    padding: 16px 16px 18px;
  }

  .hero {
    aspect-ratio: 16 / 10;
    background: var(--surface-2);
    border-radius: calc(var(--radius-lg) - 1px) calc(var(--radius-lg) - 1px) 0 0;
    overflow: hidden;
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

  /* Segmented-Pill: Entweder-oder-Umschalter in der Karte */
  .modeswitch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    margin-top: 14px;
    padding: 4px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .seg-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-dim);
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .seg-btn:hover {
    color: var(--text);
  }
  .seg-btn.active {
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
  }

  /* === Karten-Footer: Versionen + Importieren === */
  .card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 0 0 calc(var(--radius-lg) - 1px) calc(var(--radius-lg) - 1px);
  }

  .card-actions .version-dropdown {
    position: relative; /* Anker für das nach unten aufklappende Menü */
    min-width: 0;
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
    max-width: 220px;
  }
  .version-trigger span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    top: calc(100% + 8px);
    bottom: auto;
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

  /* Importieren-Button rechts — Akzent wie primäre Aktion, aber
     kompakt (Platz neben dem Versions-Dropdown sparen). */
  .import-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-left: auto;
    min-height: var(--tap);
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--accent-contrast);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .import-btn:hover {
    filter: brightness(1.08);
  }
  .import-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  /* === Zutaten & Schritte (klassische Ansicht) === */
  .block {
    margin-top: 22px;
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
