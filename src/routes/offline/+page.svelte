<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';

  let isOnline = $state(navigator.onLine);

  function updateOnlineStatus() {
    isOnline = navigator.onLine;
  }

  onMount(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  });
</script>

<svelte:head>
  <title>Offline - Koch-App</title>
  <meta name="description" content="Du bist offline. Einige Inhalte sind verfügbar." />
</svelte:head>

<div class="offline-page">
  <div class="offline-container">
    <div class="icon-large">
      <Icon name="soup" size={64} />
    </div>
    
    <h1>Offline</h1>
    
    {#if isOnline}
      <p class="status-online">
        Du bist wieder online! <a href="/">Zur Startseite</a>
      </p>
    {:else}
      <p class="status-offline">
        Du bist gerade offline. Einige Inhalte sind weiterhin verfügbar.
      </p>
    {/if}
    
    <div class="offline-tips">
      <h3>Verfügbare Inhalte:</h3>
      <ul>
        <li><Icon name="phone" size={18} /> Zuvor angesehene Rezepte</li>
        <li><Icon name="image" size={18} /> Zwischengespeicherte Bilder</li>
        <li><Icon name="settings" size={18} /> App-Einstellungen</li>
      </ul>
    </div>
    
    <div class="actions">
      <a href="/" class="btn btn-primary">Zur Startseite</a>
    </div>
    
    <p class="hint">
      Verbindung wird automatisch wiederhergestellt, sobald du wieder online bist.
    </p>
  </div>
</div>

<style>
  .offline-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--bg);
  }

  .offline-container {
    max-width: 400px;
    width: 100%;
    text-align: center;
  }

  .icon-large {
    font-size: 4rem;
    margin-bottom: 24px;
    opacity: 0.8;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 16px;
    color: var(--text);
  }

  .status-online,
  .status-offline {
    color: var(--text-dim);
    margin-bottom: 24px;
    line-height: 1.6;
  }

  .status-online {
    color: var(--success);
  }

  .status-offline {
    color: var(--text-dim);
  }

  .offline-tips {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    margin-bottom: 24px;
    text-align: left;
  }

  .offline-tips h3 {
    font-size: 1rem;
    margin-bottom: 12px;
    color: var(--text);
  }

  .offline-tips ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .offline-tips li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    color: var(--text-dim);
    font-size: 0.95rem;
  }

  .actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 16px;
  }

  .hint {
    color: var(--text-faint);
    font-size: 0.85rem;
    margin: 0;
  }

  a {
    color: var(--accent);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
</style>