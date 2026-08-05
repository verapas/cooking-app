<script lang="ts">
  import Icon from './Icon.svelte';

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
      if (!res.ok) {
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
  <input
    bind:this={inputEl}
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif"
    onchange={onChange}
    hidden
  />
  <button class="btn" onclick={() => inputEl?.click()} disabled={busy}>
    {#if busy}<Icon name="hourglass" size={18} /> Lade hoch…{:else}<Icon name="camera" size={18} /> Bild hochladen / ändern{/if}
  </button>
  {#if error}<p class="err">{error}</p>{/if}
</div>

<style>
  .upload {
    margin: 14px 0 4px;
  }
  .err {
    color: var(--danger);
    font-size: 0.85rem;
    margin: 8px 0 0;
  }
</style>
