<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>{page.status} – Koch-App</title>
</svelte:head>

<main class="container error">
  <p class="big">{page.status}</p>
  <h1>{page.status === 404 ? 'Nicht gefunden' : 'Hoppla'}</h1>
  <p class="dim">{page.error?.message ?? 'Hier ist etwas schiefgelaufen.'}</p>
  <a href="/" class="btn btn-primary">← Zur Startseite</a>
</main>

<style>
  .error {
    text-align: center;
    padding-top: 48px;
  }
  .big {
    font-size: 4rem;
    font-weight: 800;
    color: var(--accent);
    margin: 0;
    line-height: 1;
  }
  .error h1 {
    margin: 8px 0 4px;
  }
  .btn {
    margin-top: 20px;
  }
</style>
