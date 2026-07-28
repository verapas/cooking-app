<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  let isOnline = $state(browser ? navigator.onLine : true);

  function updateOnlineStatus() {
    if (!browser) return;
    isOnline = navigator.onLine;
  }

  onMount(() => {
    if (!browser) return;
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener('online', updateOnlineStatus);
    window.removeEventListener('offline', updateOnlineStatus);
  });
</script>

{#if !isOnline}
  <div class="offline-indicator">
    <div class="offline-content">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 1l22 22"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
      <span>Offline — cached content available</span>
    </div>
  </div>
{/if}

<style>
  .offline-indicator {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #2a2319;
    color: #ff5c5c;
    padding: 8px 16px;
    text-align: center;
    z-index: 2000;
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(10px);
  }

  .offline-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .offline-content svg {
    flex-shrink: 0;
  }

  @media (min-width: 560px) {
    .offline-indicator {
      padding: 10px 24px;
    }
  }
</style>