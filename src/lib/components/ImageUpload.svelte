<script lang="ts">
  import { auth } from '$lib/auth.svelte';

  let {
    recipeId,
    onUploaded
  }: {
    recipeId: number;
    onUploaded?: (url: string) => void;
  } = $props();

  let inputEl = $state<HTMLInputElement | undefined>(undefined);
  let busy = $state(false);
  let error = $state('');

  async function onChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    busy = true;
    error = '';
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`/api/recipes/${recipeId}/image`, {
        method: 'POST',
        body: fd
      });
      if (res.status === 401) {
        error = 'Nicht autorisiert – bitte neu einloggen.';
      } else if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        error = 'Upload fehlgeschlagen' + (data.error ? ': ' + data.error : '');
      } else {
        const data = (await res.json()) as { image_url: string };
        onUploaded?.(data.image_url);
      }
    } catch {
      error = 'Verbindungsfehler.';
    } finally {
      busy = false;
      if (inputEl) inputEl.value = '';
    }
  }
</script>

<div class="upload">
  {#if auth.isLoggedIn}
    <input
      bind:this={inputEl}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      onchange={onChange}
      hidden
    />
    <button class="btn" onclick={() => inputEl?.click()} disabled={busy}>
      {#if busy}⏳ Lade hoch…{:else}📷 Bild hochladen / ändern{/if}
    </button>
  {:else}
    <p class="hint">
      📝 Um ein Bild hinzuzufügen,
      <a href="/login">als Admin einloggen</a>.
    </p>
  {/if}
  {#if error}<p class="err">{error}</p>{/if}
</div>

<style>
  .upload {
    margin: 14px 0 4px;
  }
  .hint {
    color: var(--text-dim);
    font-size: 0.9rem;
    margin: 0;
  }
  .hint a {
    color: var(--accent);
  }
  .err {
    color: var(--danger);
    font-size: 0.85rem;
    margin: 8px 0 0;
  }
</style>
