<script lang="ts">
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  import ImageUpload from '$lib/components/ImageUpload.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data }: { data: PageData } = $props();

  let title = $state(data.recipe.title);
  let description = $state(data.recipe.description ?? '');
  let categoryId = $state(data.recipe.category_id?.toString() ?? '');
  let baseServings = $state(data.recipe.base_servings);
  let prepTimeMin = $state(data.recipe.prep_time_min ?? 0);
  let cookTimeMin = $state(data.recipe.cook_time_min ?? 0);
  let imageUrl = $state(data.recipe.image_url);
  let source = $state(data.recipe.source ?? '');
  let versionName = $state(data.recipe.version_name ?? '');

  let steps = $state([...data.recipe.steps].sort((a, b) => a.order - b.order));
  let ingredients = $state([...data.recipe.ingredients].sort((a, b) => a.sort_order - b.sort_order));

  let hasVersions = $derived(data.versions.length > 1);
  let categories = $derived(data.categories);
  // Aktuell bearbeitete Version: Die Version wird VOR dem Bearbeiten auf der
  // Detailseite ausgewählt — hier nur noch statisch anzeigen, welcher das ist.
  let currentVersion = $derived(data.versions.find(v => v.id === data.recipe.id));
  let isMainVersion = $derived(currentVersion?.is_main ?? true);
  let currentVersionLabel = $derived(
    currentVersion?.version_name || (isMainVersion ? 'Standard' : `Variante #${data.recipe.id}`)
  );

  let isSaving = $state(false);
  let error = $state('');

  function addStep() {
    const maxOrder = steps.length > 0 ? Math.max(...steps.map(s => s.order)) : 0;
    steps = [...steps, {
      id: -Date.now(),
      recipe_id: data.recipe.id,
      order: maxOrder + 1,
      instruction: '',
      duration_sec: null
    }];
  }

  function removeStep(stepId: number) {
    steps = steps.filter(s => s.id !== stepId);
    reorderSteps();
  }

  function updateStep(stepId: number, field: string, value: any) {
    steps = steps.map(s => s.id === stepId ? { ...s, [field]: value } : s);
  }

  function moveStep(stepId: number, direction: 'up' | 'down') {
    const index = steps.findIndex(s => s.id === stepId);
    if (index < 0) return;

    const newSteps = [...steps];
    if (direction === 'up' && index > 0) {
      [newSteps[index], newSteps[index - 1]] = [newSteps[index - 1], newSteps[index]];
    } else if (direction === 'down' && index < steps.length - 1) {
      [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    }

    steps = newSteps.map((s, i) => ({ ...s, order: i + 1 }));
  }

  function reorderSteps() {
    steps = steps.map((s, i) => ({ ...s, order: i + 1 }));
  }

  function addIngredient() {
    const maxSortOrder = ingredients.length > 0 ? Math.max(...ingredients.map(i => i.sort_order)) : 0;
    ingredients = [...ingredients, {
      id: -Date.now(),
      recipe_id: data.recipe.id,
      step_id: null,
      name: '',
      quantity: null,
      unit: '',
      sort_order: maxSortOrder + 1
    }];
  }

  function removeIngredient(ingredientId: number) {
    ingredients = ingredients.filter(i => i.id !== ingredientId);
    reorderIngredients();
  }

  function updateIngredient(ingredientId: number, field: string, value: any) {
    ingredients = ingredients.map(i => i.id === ingredientId ? { ...i, [field]: value } : i);
  }

  function reorderIngredients() {
    ingredients = ingredients.map((i, index) => ({ ...i, sort_order: index }));
  }

  async function save() {
    if (!title.trim()) {
      error = 'Titel ist erforderlich';
      return;
    }

    if (steps.length === 0) {
      error = 'Mindestens ein Schritt ist erforderlich';
      return;
    }

    isSaving = true;
    error = '';

    try {
      const stepInputs = steps.map((s, index) => ({
        order: index + 1,
        instruction: s.instruction,
        duration_sec: s.duration_sec
      }));

      const ingredientInputs = ingredients.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        step_order: i.step_id ? steps.find(s => s.id === i.step_id)?.order : null,
        sort_order: ingredients.indexOf(i)
      }));

      const body = {
        title: title.trim(),
        description: description.trim() || null,
        category_id: categoryId ? Number(categoryId) : null,
        base_servings: baseServings,
        prep_time_min: prepTimeMin || null,
        cook_time_min: cookTimeMin || null,
        image_url: imageUrl,
        source: source.trim() || null,
        version_name: !isMainVersion && versionName.trim() ? versionName.trim() : null,
        steps: stepInputs,
        ingredients: ingredientInputs
      };

      const res = await fetch(`/api/recipes/${data.recipe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (res.ok) {
        goto(`/recipe/${data.recipe.id}`);
      } else {
        const data = await res.json();
        error = data.error || 'Fehler beim Speichern';
      }
    } catch (e) {
      error = 'Verbindungsfehler';
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:head>
  <title>{title} bearbeiten – Koch-App</title>
</svelte:head>

<main class="container edit">
  <div class="edit-header">
    <a href="/recipe/{data.recipe.id}" class="back-link">← Zurück</a>
    <h1>Rezept bearbeiten</h1>
  </div>

  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  {#if hasVersions}
    <div class="version-badge">
      <Icon name="branch" size={16} />
      <span>
        Du bearbeitest: <strong>{currentVersionLabel}</strong>
        ({isMainVersion ? 'Hauptrezept' : 'Variante'})
      </span>
      <span class="hint">Andere Version? Wähle sie auf der Rezept-Seite aus, bevor du bearbeitest.</span>
    </div>
  {/if}

  <form class="edit-form" onsubmit={(e) => { e.preventDefault(); save(); }}>
    <section class="form-section">
      <h2>Grundinformationen</h2>

      <div class="form-group">
        <label for="title">Titel *</label>
        <input id="title" type="text" bind:value={title} required />
      </div>

      {#if !isMainVersion}
        <div class="form-group">
          <label for="versionName">Versionsname</label>
          <input
            id="versionName"
            type="text"
            bind:value={versionName}
            maxlength="80"
            placeholder="z. B. Mit Hüttenkäse, Schnelle Version, Vegetarisch"
          />
        </div>
      {/if}

      <div class="form-group">
        <label for="description">Beschreibung</label>
        <textarea id="description" bind:value={description} rows="3"></textarea>
      </div>

      <div class="form-group">
        <label for="category">Kategorie</label>
        <select id="category" bind:value={categoryId}>
          <option value="">Keine Kategorie</option>
          {#each categories as cat (cat.id)}
            <option value={cat.id}>{cat.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="servings">Portionen</label>
          <input id="servings" type="number" bind:value={baseServings} min="1" style="width: 100%; min-width: 0;" />
        </div>

        <div class="form-group">
          <label for="prepTime">Prep-Zeit (Min)</label>
          <input id="prepTime" type="number" bind:value={prepTimeMin} min="0" style="width: 100%; min-width: 0;" />
        </div>

        <div class="form-group">
          <label for="cookTime">Kochzeit (Min)</label>
          <input id="cookTime" type="number" bind:value={cookTimeMin} min="0" style="width: 100%; min-width: 0;" />
        </div>
      </div>

      <style>
        .form-row .form-group input {
          width: 100%;
          min-width: 0;
        }

        @media (max-width: 559px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <div class="form-group">
        <label for="source">Quelle</label>
        <input id="source" type="text" bind:value={source} />
      </div>
    </section>

    <section class="form-section">
      <h2>Bild</h2>
      <ImageUpload recipeId={data.recipe.id} onUploaded={(u) => imageUrl = u} />
    </section>

    <section class="form-section">
      <h2>Zutaten</h2>

      {#each ingredients as ingredient (ingredient.id)}
        <div class="ingredient-item">
          <div class="item-header">
            <div class="item-actions">
              <button
                type="button"
                class="btn-icon btn-danger"
                onclick={() => removeIngredient(ingredient.id)}
                aria-label="Zutat löschen"
              ><Icon name="trash" size={18} /></button>
            </div>
          </div>

          <div class="form-row ingredients-row">
            <div class="form-group form-group-name">
              <label>Name</label>
              <input type="text" bind:value={ingredient.name} required />
            </div>

            <div class="form-group">
              <label>Menge</label>
              <input type="number" bind:value={ingredient.quantity} step="0.1" />
            </div>

            <div class="form-group">
              <label>Einheit</label>
              <input type="text" bind:value={ingredient.unit} />
            </div>
          </div>

          <div class="form-group">
            <label>Zuordnung zu Schritt</label>
            <select bind:value={ingredient.step_id}>
              <option value={null}>Global (alle Schritte)</option>
              {#each steps as step (step.id)}
                <option value={step.id}>Schritt {step.order}</option>
              {/each}
            </select>
          </div>
        </div>
      {/each}

      <button type="button" class="btn btn-secondary" onclick={addIngredient}>+ Zutat hinzufügen</button>
    </section>

    <section class="form-section">
      <h2>Schritte</h2>

      {#each steps as step (step.id)}
        <div class="step-item">
          <div class="step-header">
            <span class="step-number">{step.order}</span>
            <div class="step-actions">
              <button type="button" class="btn-icon" onclick={() => moveStep(step.id, 'up')} disabled={step.order === 1}>↑</button>
              <button type="button" class="btn-icon" onclick={() => moveStep(step.id, 'down')} disabled={step.order === steps.length}>↓</button>
              <button type="button" class="btn-icon btn-danger" onclick={() => removeStep(step.id)} aria-label="Schritt löschen"><Icon name="trash" size={18} /></button>
            </div>
          </div>

          <div class="form-group">
            <label>Anleitung</label>
            <textarea bind:value={step.instruction} rows="2" required></textarea>
          </div>

          <div class="form-group">
            <label>Dauer (Sekunden) - optional für Timer</label>
            <input type="number" bind:value={step.duration_sec} min="0" placeholder="z.B. 600 für 10 Minuten" />
          </div>
        </div>
      {/each}

      <button type="button" class="btn btn-secondary" onclick={addStep}>+ Schritt hinzufügen</button>
    </section>

    <div class="form-actions sticky">
      <button type="button" class="btn" onclick={() => goto(`/recipe/${data.recipe.id}`)}>Abbrechen</button>
      <button type="submit" class="btn btn-primary" disabled={isSaving}>
        {isSaving ? 'Speichern…' : 'Speichern'}
      </button>
    </div>
  </form>
</main>

<style>
  .edit {
    padding-bottom: 100px;
  }

  .edit-header {
    margin-bottom: 20px;
  }

  .edit-header h1 {
    font-size: 1.5rem;
    margin: 8px 0;
  }

  .error-banner {
    background: var(--danger);
    color: white;
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    margin-bottom: 16px;
  }

  .version-badge {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 8px;
    margin: 12px 0 20px;
    padding: 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  .version-badge strong {
    color: var(--text);
  }

  .version-badge .hint {
    flex-basis: 100%;
    font-size: 0.78rem;
    color: var(--text-faint);
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
  }

  .form-section h2 {
    font-size: 1.1rem;
    margin: 0 0 16px;
    color: var(--accent);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 0.85rem;
    color: var(--text-dim);
    font-weight: 500;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font-size: 1rem;
    min-height: var(--tap);
  }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--accent);
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 12px;
  }

  /* Zutaten-Zeile: mobil untereinander, ab 560px Name breiter als Menge/Einheit. */
  .form-row.ingredients-row {
    grid-template-columns: 1fr;
  }

  .form-row.ingredients-row .form-group-name input {
    width: 100%;
    min-width: 0;
  }

  @media (min-width: 560px) {
    .form-row.ingredients-row {
      grid-template-columns: 2fr 1fr 1fr;
    }

    .form-row {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .step-item,
  .ingredient-item {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px;
    margin-bottom: 12px;
    overflow-x: hidden;
  }

  .step-header,
  .item-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .item-actions,
  .step-actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }

  .step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 700;
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .btn-icon {
    width: 36px;
    height: 36px;
    min-height: 36px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    transition: all 0.15s ease;
  }

  .btn-icon:hover:not(:disabled) {
    background: var(--surface-2);
    border-color: var(--accent);
  }

  .btn-icon:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-danger {
    color: var(--danger);
    border-color: rgba(255, 92, 92, 0.3);
  }

  .btn-danger:hover:not(:disabled) {
    background: rgba(255, 92, 92, 0.1);
    border-color: var(--danger);
  }

  .btn-secondary {
    width: 100%;
    margin-top: 8px;
    background: var(--surface-2);
    border-color: var(--border);
  }

  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }

  .form-actions .btn {
    flex: 1;
    min-height: var(--tap);
  }

  .sticky {
    position: sticky;
    bottom: 0;
    background: var(--bg);
    padding: 16px;
    margin: 0 -16px -16px;
    border-top: 1px solid var(--border);
  }

  @media (min-width: 560px) {
    .sticky {
      margin: 0;
      padding: 16px;
    }

    .form-row {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>