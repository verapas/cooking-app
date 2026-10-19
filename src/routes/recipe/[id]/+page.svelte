<script lang="ts">
  import { untrack } from 'svelte';
  import type { PageData } from './$types';
  import PortionControls from '$lib/components/PortionControls.svelte';
  import IngredientList from '$lib/components/IngredientList.svelte';
  import Stepper from '$lib/components/Stepper.svelte';
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
      const res = await fetch(`/api/recipes/${recipe.id}/image`, {
        method: 'POST',
        body: fd,
        credentials: 'include'
      });
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
    const mainId = data.versions.find((v) => v.is_main)?.id ?? recipe.id;
    const onMain = recipe.id === mainId;

    if (hasVersions && !onMain) {
      // Variante offen: nur diese Version ODER die ganze Familie löschen
      const result = await Swal.fire({
        title: 'Version löschen?',
        html: `Du löschst die Variante <strong>„${recipe.version_name ?? 'Variante'}"</strong>.<br>Das Hauptrezept „${recipe.title}" bleibt dabei erhalten.`,
        icon: 'warning',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: '#ff5c5c',
        denyButtonColor: '#e8652a',
        cancelButtonColor: '#3a3024',
        confirmButtonText: 'Nur diese Version',
        denyButtonText: 'Alles löschen',
        cancelButtonText: 'Abbrechen',
        background: '#1f1a14',
        color: '#f5ede2'
      });
      if (result.isConfirmed) {
        await doDelete(recipe.id, 'version', `/recipe/${mainId}`);
      } else if (result.isDenied) {
        await doDelete(recipe.id, 'all', '/');
      }
      return;
    }

    if (hasVersions && onMain) {
      // Hauptversion trägt alle Varianten (DB-Cascade) → nur alles löschen
      const result = await Swal.fire({
        title: 'Alle Versionen löschen?',
        html: `„<strong>${recipe.title}</strong>" hat Varianten. Das Löschen der Hauptversion entfernt das komplette Rezept inklusive aller Varianten — auch einzeln nicht möglich.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff5c5c',
        cancelButtonColor: '#3a3024',
        confirmButtonText: 'Alles löschen',
        cancelButtonText: 'Abbrechen',
        background: '#1f1a14',
        color: '#f5ede2'
      });
      if (result.isConfirmed) await doDelete(recipe.id, 'all', '/');
      return;
    }

    // Rezept ohne Varianten: normaler Lösch-Dialog
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
    if (result.isConfirmed) await doDelete(recipe.id, 'version', '/');
  }

  /** Führt den Delete aus (scope steuert Version vs. Familie) und leitet weiter. */
  async function doDelete(id: number, scope: 'version' | 'all', redirectTo: string) {
    try {
      const res = await fetch(`/api/recipes/${id}${scope === 'all' ? '?scope=all' : ''}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        await Swal.fire({
          title: 'Gelöscht!',
          text: scope === 'all' ? 'Das Rezept inklusive aller Varianten wurde gelöscht.' : 'Die Version wurde erfolgreich gelöscht.',
          icon: 'success',
          background: '#1f1a14',
          color: '#f5ede2',
          confirmButtonColor: '#ff7a3d'
        });
        window.location.href = redirectTo;
      } else {
        await Swal.fire({
          title: 'Fehler!',
          text: 'Beim Löschen ist ein Fehler aufgetreten.',
          icon: 'error',
          background: '#1f1a14',
          color: '#f5ede2',
          confirmButtonColor: '#ff5c5c'
        });
      }
    } catch {
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
</script>

<svelte:head>
  <title>{recipe.version_name ? `${recipe.title} (${recipe.version_name})` : recipe.title} – Koch-App</title>
</svelte:head>

<main class="container detail">
  <a href="/" class="back-link"><Icon name="back" size={16} /> Rezepte</a>

  <!--
    Eine große Karte gruppiert alles Rezept-Bezogene: Foto, Einordnung
    (Kategorie + Variante), Titel/Beschreibung/Tags, Portionen, Ansichts-
    umschalter und die Aktionen. Zutaten/Schritte laufen darunter weiter.
  -->
  <article class="detail-card">
    {#if imageUrl}
      <div class="hero">
        <img src={imageUrl} alt={recipe.title} />
      </div>
      <input id="image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange={onImageChange} hidden />
    {:else}
      <div class="hero hero-empty">
        <Icon name="image" size={48} />
      </div>
      <input id="image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange={onImageChange} hidden />
    {/if}
    <button
      class="hero-upload"
      onclick={() => document.getElementById('image-input')?.click()}
      disabled={uploadBusy}
      aria-label={imageUrl ? 'Bild ändern' : 'Bild hochladen'}
    >
      <Icon name="camera" size={18} />
    </button>

    <div class="card-body">
      <h1>{recipe.title}</h1>
      {#if recipe.description}<p class="desc">{recipe.description}</p>{/if}

      {#if recipe.tags.length > 0}
        <div class="recipe-tags" aria-label="Tags">
          {#each recipe.tags as tagName (tagName)}
            {@const tagEntry = data.tags.find((t) => t.name === tagName)}
            {#if tagEntry}
              <a class="recipe-tag" href="/?tag_ids={tagEntry.id}" title={`Nach "${tagName}" filtern`}>
                <Icon name="tag" size={12} /> {tagName}
              </a>
            {:else}
              <span class="recipe-tag"><Icon name="tag" size={12} /> {tagName}</span>
            {/if}
          {/each}
        </div>
      {/if}

      {#if uploadError}<p class="err">{uploadError}</p>{/if}

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

      <div class="action-group">
        <a
          href="/recipe/{recipe.id}/edit"
          class="action-btn"
          aria-label="Bearbeiten"
          title="Bearbeiten"
        >
          <Icon name="edit" size={18} />
        </a>
        <a
          href="/chat?recipe={recipe.id}"
          class="action-btn action-ai"
          aria-label="Mit KI verbessern oder neue Version"
          title="Mit KI verbessern / neue Version"
        >
          <Icon name="sparkles" size={18} />
        </a>
        <button
          type="button"
          class="action-btn action-danger"
          onclick={deleteRecipe}
          aria-label="Rezept löschen"
          title="Löschen"
        >
          <Icon name="trash" size={18} />
        </button>
      </div>
    </div>
  </article>

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
  /* === Die große Rezept-Karte === */
  .detail-card {
    position: relative; /* Anker für den Kamera-Button auf dem Foto */
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

  .detail h1 {
    font-size: 1.7rem;
    margin-top: 0;
  }
  .desc {
    color: var(--text-dim);
  }
  .recipe-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 14px;
  }
  .recipe-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-dim);
    font-size: 0.8rem;
    text-decoration: none;
  }
  a.recipe-tag:hover {
    border-color: var(--accent);
    color: var(--accent);
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
  /* Das Dropdown sitzt im Karten-Footer → klappt nach OBEN auf
     (die Karte hat overflow:hidden, nach unten würde es abgeschnitten). */
  .version-menu {
    position: absolute;
    bottom: calc(100% + 8px);
    top: auto;
    left: 0;
    min-width: 100%;
    z-index: 50;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 4px;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.35);
    animation: dropdownIn 0.15s ease;
  }
  @keyframes dropdownIn {
    from { opacity: 0; transform: translateY(4px); }
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

  /* === Aktions-Footer der Karte === */
  .card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    background: var(--surface-2);
  }

  .card-actions .version-dropdown {
    position: relative; /* Anker für das nach oben aufklappende Menü */
    min-width: 0;
  }

  /* Icon-Buttons (Bearbeiten / KI / Löschen) als Gruppe rechts —
     unabhängig davon, ob ein Varianten-Dropdown vorhanden ist. */
  .action-group {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    padding: 0;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .action-btn.action-ai {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  }

  .action-btn.action-ai:hover {
    background: color-mix(in srgb, var(--accent) 18%, var(--surface));
  }

  /* Löschen: roter Akzent, letzter in der Gruppe */
  .action-btn.action-danger {
    color: var(--danger);
    border-color: rgba(255, 92, 92, 0.3);
  }

  .action-btn.action-danger:hover {
    border-color: var(--danger);
    background: rgba(255, 92, 92, 0.1);
    color: var(--danger);
  }
</style>
