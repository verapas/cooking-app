<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { closeDrawer, nav } from '$lib/nav.svelte';
  import { auth, logout, refreshAuth } from '$lib/auth.svelte';
  import type { Category } from '$lib/types';

  let { categories }: { categories: Category[] } = $props();

  // Nach jeder Navigation den Drawer schließen und Auth-Status prüfen.
  afterNavigate(() => {
    closeDrawer();
    refreshAuth();
  });

  function isCatActive(slug: string): boolean {
    return page.url.pathname === `/category/${slug}`;
  }
</script>

{#if nav.open}
  <button
    class="overlay"
    aria-label="Navigation schließen"
    onclick={closeDrawer}
  ></button>
  <aside class="drawer" aria-label="Navigation">
    <div class="drawer-head">
      <span class="brand">🍳 Koch-App</span>
      <button class="x" aria-label="Schließen" onclick={closeDrawer}>✕</button>
    </div>

    <nav class="drawer-nav">
      <a class="item" href="/" class:active={page.url.pathname === '/'}>
        <span class="ic">🏠</span> Alle Rezepte
      </a>

      <p class="grouplabel">Kategorien</p>
      <div class="catlist">
        {#each categories as c (c.id)}
          <a
            class="item"
            href="/category/{c.slug}"
            class:active={isCatActive(c.slug)}
          >
            <span class="ic">{c.icon ?? '•'}</span>{c.name}
          </a>
        {/each}
      </div>

      <div class="divider"></div>
      <a class="item" href="/search" class:active={page.url.pathname === '/search'}>
        <span class="ic">🔍</span> Suche
      </a>

      <div class="divider"></div>
      {#if auth.isLoggedIn}
        <button class="item" onclick={async () => { await logout(); closeDrawer(); }}>
          <span class="ic">🚪</span> Abmelden
        </button>
      {:else}
        <a class="item" href="/login" class:active={page.url.pathname === '/login'}>
          <span class="ic">🔐</span> Einloggen (Admin)
        </a>
      {/if}
    </nav>
  </aside>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(0, 0, 0, 0.55);
    border: none;
    padding: 0;
    cursor: pointer;
    animation: fade 0.2s ease;
  }
  .drawer {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 100;
    width: min(82vw, 320px);
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    overflow-y: auto;
    animation: slidein 0.22s ease;
  }
  @keyframes slidein {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }
  .brand {
    font-weight: 700;
    font-size: 1.1rem;
  }
  .x {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 1.2rem;
    cursor: pointer;
    min-width: var(--tap);
    min-height: var(--tap);
  }
  .drawer-nav {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    color: var(--text);
    text-decoration: none;
    font-size: 1rem;
  }
  .item .ic {
    font-size: 1.1rem;
    width: 1.4em;
    text-align: center;
  }
  .item.active {
    background: var(--surface-2);
    color: var(--accent);
    font-weight: 600;
  }
  .grouplabel {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    margin: 14px 12px 6px;
  }
  .divider {
    height: 1px;
    background: var(--border);
    margin: 10px 8px;
  }
</style>
