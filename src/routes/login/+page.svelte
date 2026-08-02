<script lang="ts">
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';

  let username = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    busy = true;
    error = '';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        await goto('/');
      } else {
        error = data.error || 'Anmeldung fehlgeschlagen.';
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
  <h1><span class="h-ic"><Icon name="lock" size={28} /></span> Admin-Login</h1>
  <p class="dim">
    Gib Benutzername und Passwort ein, um Bilder hochzuladen. Die Session
    bleibt 7 Tage gültig.
  </p>

  <form onsubmit={submit} class="form">
    <input
      type="text"
      bind:value={username}
      placeholder="Benutzername"
      autocomplete="username"
      required
    />
    <input
      type="password"
      bind:value={password}
      placeholder="Passwort"
      autocomplete="current-password"
      required
    />
    <button class="btn btn-primary" disabled={busy || !username.trim() || !password.trim()}>
      {busy ? 'Anmelden…' : 'Einloggen'}
    </button>
  </form>

  {#if error}<p class="err">{error}</p>{/if}

  <a href="/" class="back-link"><Icon name="back" size={16} /> Zurück zur App</a>
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
  .h-ic {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
  }
</style>