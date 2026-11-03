<script lang="ts">
  import { untrack } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // State aus einem Prop initialisieren → untrack() (s. CLAUDE.md).
  let q = $state(untrack(() => data.q));

  function fmtTime(m: number | null): string {
    if (!m || m <= 0) return '';
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const r = m % 60;
      return r ? `${h}h ${r}m` : `${h}h`;
    }
    return `${m} Min.`;
  }

  function search(e: Event) {
    e.preventDefault();
    const trimmed = q.trim();
    const url = trimmed ? `/public?q=${encodeURIComponent(trimmed)}` : '/public';
    history.pushState({}, '', url);
    invalidateAll();
  }
</script>

<svelte:head>
  <title>Öffentlich – Koch-App</title>
</svelte:head>

<main class="container list">
  <header class="head">
    <h1><Icon name="globe" size={22} /> Öffentlich</h1>
    <p class="dim">
      Rezepte, die Mitglieder dieser App veröffentlicht haben — aus allen
      Spaces. Du kannst sie als Kopie in deinen eigenen Space übernehmen.
    </p>
    <form onsubmit={search} class="search">
      <input
        type="search"
        bind:value={q}
        placeholder="Veröffentlichte Rezepte durchsuchen…"
        aria-label="Suche"
      />
      <button type="submit" class="btn" aria-label="Suchen"><Icon name="search" size={18} /></button>
    </form>
  </header>

  {#if data.recipes.length === 0}
    <p class="empty">
      <Icon name="info" size={16} />
      {data.q
        ? 'Keine veröffentlichten Rezepte gefunden.'
        : 'Noch keine veröffentlichten Rezepte. Veröffentliche eines deiner Rezepte über den Globe-Button auf der Detailseite.'}
    </p>
  {:else}
    <section class="grid">
      {#each data.recipes as r (r.id)}
        <a class="card" href="/public/{r.id}">
          {#if r.image_url}
            <img class="img" src={r.image_url} alt="" loading="lazy" />
          {:else}
            <div class="img img-empty"><Icon name="image" size={28} /></div>
          {/if}
          <div class="body">
            <span class="title">{r.title}</span>
            <span class="by">
              von {r.author_name ?? 'Unbekannt'}
              {#if r.space_name}· {r.space_name}{/if}
            </span>
            <span class="meta">
              {#if r.category_name}{r.category_name} · {/if}{r.base_servings} Portionen
              {#if fmtTime((r.prep_time_min ?? 0) + (r.cook_time_min ?? 0))}
                · {fmtTime((r.prep_time_min ?? 0) + (r.cook_time_min ?? 0))}
              {/if}
            </span>
          </div>
        </a>
      {/each}
    </section>
  {/if}
</main>

<style>
  .list {
    padding-top: 16px;
    padding-bottom: 40px;
  }
  .head h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.35rem;
    margin: 14px 0 0;
  }
  .dim {
    color: var(--dim);
    font-size: 0.92rem;
    margin: 8px 0 14px;
  }
  .search {
    display: flex;
    gap: 8px;
    margin-bottom: 18px;
  }
  .search input {
    flex: 1;
    min-width: 0;
    min-height: var(--tap);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 1rem;
  }
  .search input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .empty {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: var(--dim);
    font-size: 0.92rem;
    line-height: 1.5;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }
  .card {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    color: var(--text);
    text-decoration: none;
    transition: border-color 0.15s ease;
  }
  .card:hover {
    border-color: var(--accent);
  }
  .img {
    aspect-ratio: 16 / 10;
    width: 100%;
    object-fit: cover;
    display: block;
    background: var(--surface-2);
  }
  .img-empty {
    display: grid;
    place-items: center;
    color: var(--dim);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px 12px;
  }
  .title {
    font-weight: 600;
    line-height: 1.3;
  }
  .by {
    color: var(--accent);
    font-size: 0.8rem;
  }
  .meta {
    color: var(--dim);
    font-size: 0.78rem;
  }
</style>
