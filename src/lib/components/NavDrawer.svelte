<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { closeDrawer, nav } from '$lib/nav.svelte';
  import Icon from './Icon.svelte';
  import CategoryIcon from './CategoryIcon.svelte';
  import type { Category } from '$lib/types';

  let { categories }: { categories: Category[] } = $props();

  // Nach jeder Navigation den Drawer schließen.
  afterNavigate(() => {
    closeDrawer();
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
  <aside class="drawer" class:closing={!nav.open} aria-label="Navigation">
    <div class="drawer-head">
      <span class="brand"><span class="brand-ic"><Icon name="pot" size={20} /></span> Koch-App</span>
      <button class="x" aria-label="Schließen" onclick={closeDrawer}><Icon name="close" size={20} /></button>
    </div>

    <nav class="drawer-nav">
      <a class="item" href="/" class:active={page.url.pathname === '/'}>
        <span class="ic"><Icon name="home" size={20} /></span> Alle Rezepte
      </a>

      <a class="item" href="/favorites" class:active={page.url.pathname === '/favorites'}>
        <span class="ic"><Icon name="star" size={20} /></span> Favoriten
      </a>

      <a
        class="item"
        href="/chat"
        class:active={page.url.pathname === '/chat'}
      >
        <span class="ic"><Icon name="sparkles" size={20} /></span> Neues Rezept (KI)
      </a>

      <p class="grouplabel">Kategorien</p>
      <div class="catlist">
        {#each categories as c (c.id)}
          <a
            class="item"
            href="/category/{c.slug}"
            class:active={isCatActive(c.slug)}
          >
            <span class="ic"><CategoryIcon icon={c.icon} size={20} /></span>{c.name}
          </a>
        {/each}
      </div>

      <div class="divider"></div>
      <a class="item" href="/search" class:active={page.url.pathname === '/search'}>
        <span class="ic"><Icon name="search" size={20} /></span> Suche
      </a>

      <div class="divider"></div>
      <a class="item" href="/settings" class:active={page.url.pathname.startsWith('/settings')}>
        <span class="ic"><Icon name="settings" size={20} /></span> Einstellungen
      </a>
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
    width: min(76vw, 280px);
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    overflow-y: auto;
    animation: slidein 0.22s ease;
  }
  .drawer.closing {
    animation: slideout 0.22s ease forwards;
  }
  @keyframes slidein {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
    }
  }
  @keyframes slideout {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-100%);
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
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .brand-ic {
    color: var(--accent);
    display: inline-flex;
  }
  .x {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    min-width: var(--tap);
    min-height: var(--tap);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .x:hover {
    color: var(--text);
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
    width: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .item.active {
    background: var(--surface-2);
    color: var(--accent);
    font-weight: 600;
  }
  .item-accent {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
    font-weight: 600;
  }
  .item-accent .ic {
    color: var(--accent);
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
