<script lang="ts">
  import { onMount } from 'svelte';

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }

  let deferredPrompt: BeforeInstallPromptEvent | null = null;
  let showInstallButton = $state(false);

  onMount(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      showInstallButton = true;
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      showInstallButton = false;
    });
  });

  async function install() {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      deferredPrompt = null;
      showInstallButton = false;
    }
  }
</script>

{#if showInstallButton}
  <button class="install-btn" onclick={install}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7,10 12,15 17,10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    App installieren
  </button>
{/if}

<style>
  .install-btn {
    position: fixed;
    bottom: calc(80px + env(safe-area-inset-bottom));
    right: 16px;
    z-index: 1000;
    background: var(--accent);
    color: var(--accent-contrast);
    border: none;
    padding: 12px 16px;
    border-radius: 999px;
    font-size: 0.9rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(255, 122, 61, 0.3);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .install-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(255, 122, 61, 0.4);
  }

  .install-btn:active {
    transform: translateY(0);
  }

  @media (min-width: 560px) {
    .install-btn {
      bottom: 24px;
      right: 24px;
    }
  }
</style>