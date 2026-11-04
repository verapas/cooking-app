<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import RecipeCard from '$lib/components/RecipeCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // State aus einem Prop initialisieren → untrack() (s. CLAUDE.md).
  let q = $state(untrack(() => data.q));
  let selectedTagNames = $state<string[]>(untrack(() => [...data.initialTagNames]));
  let selectedCategory = $state(untrack(() => data.initialCategory));
  let tagFilterOpen = $state(false);
  let catFilterOpen = $state(false);

  // Popover schließen bei Klick außerhalb (wie Hauptseite, beide Filter)
  $effect(() => {
    if (!tagFilterOpen && !catFilterOpen) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.tag-filter') && !target.closest('.cat-filter')) {
        tagFilterOpen = false;
        catFilterOpen = false;
      }
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  });

  /** Schreibt Suche + Filter in den URL (?) und lädt die Liste neu. */
  function applyFilters(): void {
    const params = new URLSearchParams();
    const query = q.trim();
    if (query) params.set('q', query);
    if (selectedTagNames.length > 0) params.set('tags', selectedTagNames.join(','));
    if (selectedCategory) params.set('category', selectedCategory);
    const url = params.toString() ? `/public?${params}` : '/public';
    // goto statt rohem history.pushState: SvelteKit sieht die URL-Änderung
    // sonst nicht und invalidateAll() würde den Load mit der ALTEN URL
    // (und damit ohne Filter) neu ausführen.
    void goto(url, { keepFocus: true, noScroll: true });
  }

  function search(e: Event) {
    e.preventDefault();
    applyFilters();
  }

  function clearSearch(): void {
    q = '';
    applyFilters();
  }

  function toggleTag(name: string): void {
    selectedTagNames = selectedTagNames.includes(name)
      ? selectedTagNames.filter((t) => t !== name)
      : [...selectedTagNames, name];
    applyFilters();
  }

  function resetTagFilter(): void {
    selectedTagNames = [];
    applyFilters();
  }

  /** Kategorie ist Einzelauswahl (ein Rezept hat eine Kategorie) —
      nochmaliges Antippen deaktiviert den Filter. */
  function toggleCategory(name: string): void {
    selectedCategory = selectedCategory === name ? '' : name;
    applyFilters();
  }

  let filtersActive = $derived(
    q.trim().length > 0 || selectedTagNames.length > 0 || selectedCategory !== ''
  );
</script>

<svelte:head>
  <title>Öffentlich – Koch-App</title>
</svelte:head>

<main class="container list">
  <p class="dim intro">
    Rezepte, die Mitglieder dieser App veröffentlicht haben — aus allen
    Spaces. Du kannst sie als Kopie in deinen eigenen Space übernehmen.
  </p>

  <header class="page-head">
    <form class="search-inline" onsubmit={search}>
      <div class="tag-filter">
        <button
          type="button"
          class="btn-icon-search tag-filter-btn"
          class:filter-active={selectedTagNames.length > 0}
          onclick={() => {
            tagFilterOpen = !tagFilterOpen;
            catFilterOpen = false;
          }}
          aria-label="Nach Tags filtern"
          aria-expanded={tagFilterOpen}
        >
          <Icon name="tag" size={20} />
          {#if selectedTagNames.length > 0}
            <span class="filter-count">{selectedTagNames.length}</span>
          {/if}
        </button>
        {#if tagFilterOpen}
          <div class="tag-popover" role="dialog" aria-label="Tag-Filter">
            {#if data.tags.length === 0}
              <p class="tag-empty">
                Noch keine Tags auf veröffentlichten Rezepten.
              </p>
            {:else}
              <div class="tag-options">
                {#each data.tags as tag (tag.name)}
                  <button
                    type="button"
                    class="tag-option"
                    class:selected={selectedTagNames.includes(tag.name)}
                    aria-pressed={selectedTagNames.includes(tag.name)}
                    onclick={() => toggleTag(tag.name)}
                  >
                    {tag.name} <span class="tag-option-count">{tag.count}</span>
                  </button>
                {/each}
              </div>
              {#if selectedTagNames.length > 0}
                <button type="button" class="tag-reset" onclick={resetTagFilter}>
                  Filter zurücksetzen
                </button>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
      <div class="cat-filter">
        <button
          type="button"
          class="btn-icon-search tag-filter-btn"
          class:filter-active={selectedCategory !== ''}
          onclick={() => {
            catFilterOpen = !catFilterOpen;
            tagFilterOpen = false;
          }}
          aria-label="Nach Kategorie filtern"
          aria-expanded={catFilterOpen}
        >
          <Icon name="grid" size={20} />
        </button>
        {#if catFilterOpen}
          <div class="tag-popover" role="dialog" aria-label="Kategorie-Filter">
            {#if data.categories.length === 0}
              <p class="tag-empty">
                Noch keine Kategorien auf veröffentlichten Rezepten.
              </p>
            {:else}
              <div class="tag-options">
                {#each data.categories as cat (cat.name)}
                  <button
                    type="button"
                    class="tag-option"
                    class:selected={selectedCategory === cat.name}
                    aria-pressed={selectedCategory === cat.name}
                    onclick={() => toggleCategory(cat.name)}
                  >
                    {cat.name} <span class="tag-option-count">{cat.count}</span>
                  </button>
                {/each}
              </div>
              {#if selectedCategory}
                <button
                  type="button"
                  class="tag-reset"
                  onclick={() => {
                    selectedCategory = '';
                    applyFilters();
                  }}
                >
                  Filter zurücksetzen
                </button>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
      <input
        bind:value={q}
        placeholder="Rezept suchen..."
        autocomplete="off"
      />
      {#if q}
        <button type="button" class="btn-icon-search" onclick={clearSearch} aria-label="Suche zurücksetzen"><Icon name="close" size={20} /></button>
      {/if}
      <button type="submit" class="btn-icon-search" aria-label="Suchen"><Icon name="search" size={20} /></button>
    </form>
  </header>

  {#if filtersActive}
    <p class="result-info">
      {data.recipes.length} Treffer{#if q.trim()} für „{q.trim()}"{/if}
      {#if selectedTagNames.length > 0}&nbsp;· Tags: {selectedTagNames.join(' + ')}{/if}
      {#if selectedCategory}&nbsp;· Kategorie: {selectedCategory}{/if}
    </p>
  {/if}

  {#if data.recipes.length === 0}
    <p class="empty">
      <Icon name="info" size={16} />
      {filtersActive
        ? 'Keine veröffentlichten Rezepte gefunden.'
        : 'Noch keine veröffentlichten Rezepte. Veröffentliche eines deiner Rezepte über den Globe-Button auf der Detailseite.'}
    </p>
  {:else}
    <section class="recipe-grid" aria-label="Veröffentlichte Rezepte">
      {#each data.recipes as r (r.id)}
        <RecipeCard recipe={r} hrefBase="/public" showActions={false} />
      {/each}
    </section>
  {/if}
</main>

<style>
  .list {
    padding-top: 16px;
    padding-bottom: 40px;
  }
  .intro {
    font-size: 0.92rem;
    margin: 0 0 14px;
  }
  .page-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
  }
  .search-inline {
    display: flex;
    gap: 6px;
    width: 100%;
  }
  .search-inline input {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font-size: 0.9rem;
  }
  .search-inline input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .result-info {
    color: var(--text-dim);
    margin: 0 0 14px;
  }
  .btn-icon-search {
    min-width: var(--tap);
    min-height: var(--tap);
    width: var(--tap);
    height: var(--tap);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-dim);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }
  .btn-icon-search:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Tag-/Kategorie-Filter: Button links neben der Suche + darunter
     aufklappendes Popover (1:1 wie die Hauptseite) */
  .tag-filter,
  .cat-filter {
    position: relative;
    flex-shrink: 0;
  }

  .tag-filter-btn {
    position: relative;
  }

  .tag-filter-btn.filter-active {
    color: var(--accent);
    border-color: var(--accent);
  }

  .filter-count {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 17px;
    height: 17px;
    padding: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-contrast);
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1;
    pointer-events: none;
  }

  .tag-popover {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: min(340px, calc(100vw - 32px));
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    padding: 12px;
    z-index: 30;
  }

  .tag-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-height: 260px;
    overflow-y: auto;
  }

  .tag-option {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-dim);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .tag-option:hover {
    border-color: var(--accent);
    color: var(--text);
  }

  .tag-option.selected {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }

  .tag-option-count {
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--surface-3);
    color: var(--text-dim);
    font-size: 0.74rem;
    font-weight: 600;
  }

  .tag-option.selected .tag-option-count {
    background: rgba(26, 14, 6, 0.25);
    color: var(--accent-contrast);
  }

  .tag-reset {
    margin-top: 10px;
    width: 100%;
    min-height: 38px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-dim);
    font-size: 0.88rem;
    cursor: pointer;
  }

  .tag-reset:hover {
    color: var(--danger);
  }

  .tag-empty {
    margin: 4px 2px;
    color: var(--text-dim);
    font-size: 0.88rem;
    line-height: 1.4;
  }
  .empty {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: var(--dim);
    font-size: 0.92rem;
    line-height: 1.5;
  }
</style>
