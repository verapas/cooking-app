<script lang="ts">
  import { untrack } from 'svelte';
  import { onMount, tick } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import type { PageData } from './$types';
  import { handleUnauthorized } from '$lib/api';
  import RecipeCard from '$lib/components/RecipeCard.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { applyPinReorder } from '$lib/recipeOrder';

  let { data }: { data: PageData } = $props();
  let searchQuery = $state('');

  // „Mehr laden": Liste startet mit den ersten 30 aus dem Server-Load,
  // weitere 30 werden per Klick über die REST-API nachgeladen.
  // State aus einem Prop initialisieren → untrack() (s. CLAUDE.md).
  const PAGE_SIZE = 30;
  let recipes = $state(untrack(() => [...data.recipes]));
  let hasMore = $state(untrack(() => data.recipes.length === PAGE_SIZE));
  let loadingMore = $state(false);

  // Live-Suche: filtert über die REST-API direkt in dieser Liste
  // (keine extra Suchseite mehr). activeQuery =Suche gerade aktiv.
  let activeQuery = $state('');
  let searching = $state(false);

  // Tag-Filter: Mehrfachauswahl mit UND-Semantik (Server prüft die
  // Rezept-Familie — Hauptrezept + Varianten). Initial aus ?tag_ids=.
  let selectedTagIds = $state<number[]>(untrack(() => [...data.initialTagIds]));
  let tagFilterOpen = $state(false);

  // Popover schließen bei Klick außerhalb
  $effect(() => {
    if (!tagFilterOpen) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.tag-filter')) tagFilterOpen = false;
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  });

  /**
   * Holt die Liste passend zu Suche + Tag-Filter (beide optional,
   * kombinierbar). Ohne aktive Filter → Gesamtliste mit „Mehr laden".
   */
  async function fetchFiltered(): Promise<void> {
    const params = new URLSearchParams();
    if (activeQuery) params.set('q', activeQuery);
    if (selectedTagIds.length > 0) params.set('tag_ids', selectedTagIds.join(','));
    updateFilterUrl();
    try {
      const res = await fetch(
        params.toString() ? `/api/recipes?${params}` : `/api/recipes?limit=${PAGE_SIZE}`
      );
      if (handleUnauthorized(res)) return;
      if (res.ok) {
        recipes = await res.json();
        hasMore =
          params.toString() === '' && recipes.length === PAGE_SIZE;
      }
    } catch {
      // Netzwerkfehler: Liste unverändert, User kann es erneut versuchen.
    }
  }

  /** Hält ?tag_ids= im URL aktuell (Reload/Teilen behält den Filter). */
  function updateFilterUrl(): void {
    const url = new URL(window.location.href);
    if (selectedTagIds.length > 0) {
      url.searchParams.set('tag_ids', selectedTagIds.join(','));
    } else {
      url.searchParams.delete('tag_ids');
    }
    // history.state bewahren — dort liegen die Restore-Daten für die
    // nachgeladenen Rezepte (siehe unten); {} würde sie löschen.
    history.replaceState(history.state, '', url);
  }

  async function runSearch(): Promise<void> {
    const q = searchQuery.trim();
    if (!q && !activeQuery) return;
    if (searching) return;
    searching = true;
    try {
      activeQuery = q; // leer = Suche zurücksetzen, Tag-Filter bleibt
      await fetchFiltered();
    } finally {
      searching = false;
    }
  }

  async function clearSearch(): Promise<void> {
    searchQuery = '';
    activeQuery = '';
    await fetchFiltered();
  }

  function toggleTag(id: number): void {
    selectedTagIds = selectedTagIds.includes(id)
      ? selectedTagIds.filter((t) => t !== id)
      : [...selectedTagIds, id];
    void fetchFiltered();
  }

  function resetTagFilter(): void {
    selectedTagIds = [];
    void fetchFiltered();
  }

  let activeTagNames = $derived(
    selectedTagIds.map((id) => data.tags.find((t) => t.id === id)?.name ?? '?')
  );

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    try {
      await fetchChunk(PAGE_SIZE);
    } finally {
      loadingMore = false;
    }
  }

  // === Restore nachgeladener Rezepte bei Rückkehr ===
  //
  // Die per „Mehr laden" nachgeladenen Rezepte leben nur im Client-State —
  // bei Navigation weg und zurück startet die Liste wieder bei den 30 aus
  // dem Server-Load, obwohl das Layout an die alte Scroll-Position springt.
  // Deshalb: Beim Wegnavigieren werden Anzahl + Scroll-Position in der
  // History-Entry (history.state) gemerkt; beim Rückkehr-Mount wird die
  // Differenz automatisch nachgeladen und an die alte Position gescrollt.
  // (Suche/Tag-Filter sind ausgenommen — dort gibt es „Mehr laden" nicht.)

  interface ListHistoryState {
    recipesLoaded?: number;
    scrollTop?: number;
    [key: string]: unknown; // u. a. SvelteKits eigenen $sveltekit-State
  }

  /** Scroll-Container gehört dem Layout (.app-scroll). */
  function appScroll(): HTMLElement | null {
    return document.querySelector('.app-scroll');
  }

  /** Zustand in die aktuelle History-Entry schreiben. */
  function persistListState(): void {
    const el = appScroll();
    history.replaceState(
      {
        ...(history.state as ListHistoryState | null),
        recipesLoaded: recipes.length,
        scrollTop: el?.scrollTop
      },
      ''
    );
  }

  beforeNavigate((nav) => {
    if (nav.from?.url.pathname !== '/') return;
    if (activeQuery || selectedTagIds.length > 0) return;
    persistListState();
  });

  onMount(async () => {
    const st = history.state as ListHistoryState | null;
    const target = st?.recipesLoaded ?? 0;
    if (target <= recipes.length || data.initialTagIds.length > 0) return;
    // Differenz in Schritten nachladen (API-Limit pro Call: 100).
    while (recipes.length < target && hasMore) {
      const ok = await fetchChunk(Math.min(PAGE_SIZE, target - recipes.length));
      if (!ok) break; // Server-/Netzwerkfehler: Button bleibt, User lädt selbst
    }
    if (typeof st?.scrollTop === 'number') {
      await tick();
      requestAnimationFrame(() => {
        const el = appScroll();
        if (el) el.scrollTop = st.scrollTop!;
      });
    }
  });

  /**
   * Lädt `limit` weitere Rezepte ab der aktuellen Listenlänge nach und
   * hängt sie an. Rückgabe false = nichts mehr zu holen / Fehler (Aufrufer
   * sollte aufhören bzw. den Button anbieten). Duplikat-IDs (Sortierung
   * hat sich zwischenzeitlich verschoben) werden übersprungen.
   */
  async function fetchChunk(limit: number): Promise<boolean> {
    try {
      const res = await fetch(`/api/recipes?limit=${limit}&offset=${recipes.length}`);
      if (handleUnauthorized(res)) return true; // Redirect läuft, Schleife beenden
      if (!res.ok) return false;
      const more = await res.json();
      if (!Array.isArray(more) || more.length === 0) {
        hasMore = false;
        return false;
      }
      const seen = new Set(recipes.map((r) => r.id));
      const fresh = more.filter((r) => !seen.has(r.id));
      recipes = [...recipes, ...fresh];
      hasMore = more.length === limit;
      // Fortschritt auch ohne Navigation sichern (überlebt F5-Reload;
      // scrollTop wird separat erst beim Wegnavigieren gemerkt).
      history.replaceState(
        { ...(history.state as ListHistoryState | null), recipesLoaded: recipes.length },
        ''
      );
      return fresh.length > 0;
    } catch {
      return false; // Netzwerkfehler: Button bleibt, User kann es erneut versuchen.
    }
  }

  function handleSearch() {
    void runSearch();
  }

  // Pin live umsetzen: Karte soll beim Klick direkt nach oben rutschen
  // (Position wird sonst erst beim nächsten Laden vom Server sortiert).
  function handlePinChange(id: number, pinned: boolean): void {
    recipes = applyPinReorder(recipes, id, pinned);
  }
</script>

<svelte:head>
  <title>Koch-App – Rezepte</title>
</svelte:head>

<main class="container">
  <header class="page-head">
    <form class="search-inline" onsubmit={(e) => { e.preventDefault(); handleSearch(); }}>
      <div class="tag-filter">
        <button
          type="button"
          class="btn-icon-search tag-filter-btn"
          class:filter-active={selectedTagIds.length > 0}
          onclick={() => (tagFilterOpen = !tagFilterOpen)}
          aria-label="Nach Tags filtern"
          aria-expanded={tagFilterOpen}
        >
          <Icon name="tag" size={20} />
          {#if selectedTagIds.length > 0}
            <span class="filter-count">{selectedTagIds.length}</span>
          {/if}
        </button>
        {#if tagFilterOpen}
          <div class="tag-popover" role="dialog" aria-label="Tag-Filter">
            {#if data.tags.length === 0}
              <p class="tag-empty">
                Noch keine Tags vorhanden. Setze sie im Rezept-Formular oder
                unter Einstellungen → Tags.
              </p>
            {:else}
              <div class="tag-options">
                {#each data.tags as tag (tag.id)}
                  <button
                    type="button"
                    class="tag-option"
                    class:selected={selectedTagIds.includes(tag.id)}
                    aria-pressed={selectedTagIds.includes(tag.id)}
                    onclick={() => toggleTag(tag.id)}
                  >
                    {tag.name} <span class="tag-option-count">{tag.count}</span>
                  </button>
                {/each}
              </div>
              {#if selectedTagIds.length > 0}
                <button type="button" class="tag-reset" onclick={resetTagFilter}>
                  Filter zurücksetzen
                </button>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
      <input
        bind:value={searchQuery}
        placeholder="Rezept suchen..."
        autocomplete="off"
      />
      {#if activeQuery}
        <button type="button" class="btn-icon-search" onclick={clearSearch} aria-label="Suche zurücksetzen"><Icon name="close" size={20} /></button>
      {/if}
      <button type="submit" class="btn-icon-search" aria-label="Suchen" disabled={searching}><Icon name="search" size={20} /></button>
    </form>
  </header>

  {#if activeQuery || selectedTagIds.length > 0}
    <p class="result-info">
      {recipes.length} Treffer{#if activeQuery} für „{activeQuery}"{/if}
      {#if selectedTagIds.length > 0}&nbsp;· Tags: {activeTagNames.join(' + ')}{/if}
    </p>
  {/if}

  <section class="recipe-grid" aria-label="Rezepte">
    {#each recipes as recipe (recipe.id)}
      <RecipeCard {recipe} onPinChange={handlePinChange} />
    {:else}
      <p class="dim">{activeQuery || selectedTagIds.length > 0 ? 'Nichts gefunden.' : 'Noch keine Rezepte vorhanden.'}</p>
    {/each}
  </section>

  {#if hasMore}
    <div class="load-more">
      <button type="button" class="btn load-more-btn" onclick={loadMore} disabled={loadingMore}>
        {loadingMore ? 'Lädt…' : 'Mehr laden'}
      </button>
    </div>
  {/if}
</main>

<style>
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

  /* Tag-Filter: Button links neben der Suche + darunter aufklappendes Popover */
  .tag-filter {
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
  .load-more {
    display: flex;
    justify-content: center;
    margin-top: 16px;
  }
  .load-more-btn {
    min-height: var(--tap);
    padding: 10px 24px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 0.95rem;
  }
  .load-more-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .load-more-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
