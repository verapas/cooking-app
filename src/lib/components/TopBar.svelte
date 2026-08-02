<script lang="ts">
  import { toggleDrawer } from '$lib/nav.svelte';
  import Icon from './Icon.svelte';
</script>

<header class="topbar">
  <button
    class="burger"
    onclick={toggleDrawer}
    aria-label="Menü öffnen"
    aria-haspopup="true"
  >
    <span></span><span></span><span></span>
  </button>
  <a href="/" class="title">
    <span class="logo"><Icon name="pot" size={20} /></span> Koch-App
  </a>
</header>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 56px;
    padding: 0 12px;
    padding-top: env(safe-area-inset-top);
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .burger {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: var(--tap);
    height: var(--tap);
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 10px;
  }
  .burger span {
    display: block;
    width: 22px;
    height: 2px;
    background: var(--text);
    border-radius: 2px;
  }
  .title {
    font-weight: 700;
    font-size: 1.05rem;
    color: var(--text);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .logo {
    color: var(--accent);
    display: inline-flex;
  }
</style>
