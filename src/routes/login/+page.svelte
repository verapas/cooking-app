<script lang="ts">
  import { goto } from '$app/navigation';
  import { setToken } from '$lib/auth.svelte';

  let token = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    const t = token.trim();
    if (!t) return;
    busy = true;
    error = '';
    try {
      const res = await fetch('/api/auth/verify', {
        headers: { Authorization: 'Bearer ' + t }
      });
      if (res.ok) {
        setToken(t);
        await goto('/');
      } else {
        error = 'Token ungültig. Bitte überprüfen.';
      }
    } catch {
      error = 'Verbindungsfehler.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Admin-Login – Koch-App</title>
</svelte:head>

<main class="container login">
  <h1>🔐 Admin-Login</h1>
  <p class="dim">
    Gib den API-Token ein, um Bilder hochzuladen. Er bleibt dauerhaft auf
    diesem Gerät gespeichert (localStorage) – bis du dich abmeldest.
  </p>

  <form onsubmit={submit} class="form">
    <input
      type="password"
      bind:value={token}
      placeholder="API-Token"
      autocomplete="off"
      required
    />
    <button class="btn btn-primary" disabled={busy || !token.trim()}>
      {busy ? 'Prüfe…' : 'Einloggen'}
    </button>
  </form>

  {#if error}<p class="err">{error}</p>{/if}

  <a href="/" class="back-link">← Zurück zur App</a>
</main>

<style>
  .login {
    padding-top: 20px;
  }
  .login .dim {
    margin-bottom: 18px;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .form input {
    min-height: var(--tap);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font-size: 1rem;
  }
  .form input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .err {
    color: var(--danger);
    margin-top: 12px;
  }
</style>
