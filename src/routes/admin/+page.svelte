<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Swal from 'sweetalert2';
  import { handleUnauthorized, readJson } from '$lib/api';
  import Icon from '$lib/components/Icon.svelte';
  import type { PageData } from './$types';
  import type { SpaceRole } from '$lib/types';

  let { data }: { data: PageData } = $props();

  let busy = $state(false);
  let errorMsg = $state('');
  let notice = $state('');

  // --- Benutzer erstellen ---
  let showCreate = $state(false);
  let newUsername = $state('');
  let newEmail = $state('');
  let newName = $state('');
  let newPassword = $state('');
  let newSpaceId = $state<number | 0>(0); // 0 = kein Space (persönlicher Space beim ersten Login)
  let newRole = $state<SpaceRole>('member');

  function displayName(u: {
    name?: string | null;
    username?: string | null;
    email?: string | null;
    id?: number;
    user_id?: number;
  }): string {
    return u.name || u.username || u.email || `#${u.id ?? u.user_id ?? '?'}`;
  }

  async function api(
    url: string,
    init: RequestInit,
    successMsg?: string
  ): Promise<{ ok: boolean }> {
    if (busy) return { ok: false };
    busy = true;
    errorMsg = '';
    notice = '';
    try {
      const res = await fetch(url, { credentials: 'include', ...init });
      if (handleUnauthorized(res)) return { ok: false };
      const body = await readJson(res);
      if (!res.ok) {
        // error(...) aus Routen liefert {message}, json({error}) liefert {error}
        errorMsg = body.error || (body.message as string | undefined) || 'Aktion fehlgeschlagen.';
        return { ok: false };
      }
      if (successMsg) notice = successMsg;
      await invalidateAll();
      return { ok: true };
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Verbindungsfehler.';
      return { ok: false };
    } finally {
      busy = false;
    }
  }

  const jsonInit = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  // --- Aktionen: Benutzer ---
  async function createUser(e: Event) {
    e.preventDefault();
    const username = newUsername.trim();
    if (!username || newPassword.length < 6 || busy) return;
    const ok = await api(
      '/api/admin/users',
      jsonInit('POST', {
        username,
        email: newEmail.trim() || undefined,
        name: newName.trim() || undefined,
        password: newPassword,
        space_id: newSpaceId || undefined,
        role: newRole
      }),
      `Benutzer „${username}“ angelegt — Passwort muss beim ersten Login geändert werden.`
    );
    if (ok) {
      newUsername = '';
      newEmail = '';
      newName = '';
      newPassword = '';
      newSpaceId = 0;
      newRole = 'member';
      showCreate = false;
    }
  }

  async function toggleAdmin(userId: number, current: boolean, label: string) {
    await api(
      `/api/admin/users/${userId}`,
      jsonInit('PUT', { is_admin: !current }),
      !current ? `„${label}“ ist jetzt App-Admin.` : `Admin-Rechte von „${label}“ entfernt.`
    );
  }

  async function setActiveSpace(userId: number, spaceId: number) {
    await api(`/api/admin/users/${userId}`, jsonInit('PUT', { active_space_id: spaceId }), 'Aktiver Space gesetzt.');
  }

  // --- Aktionen: Spaces ---
  async function createSpace(e: Event) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const input = form.querySelector('input');
    const name = (input?.value ?? '').trim();
    if (!name || busy) return;
    const ok = await api('/api/admin/spaces', jsonInit('POST', { name }), `Space „${name}“ angelegt.`);
    if (ok && input) input.value = '';
  }

  async function renameSpace(spaceId: number, current: string) {
    const { value: name } = await Swal.fire({
      title: 'Space umbenennen',
      input: 'text',
      inputValue: current,
      showCancelButton: true,
      confirmButtonText: 'Umbenennen',
      cancelButtonText: 'Abbrechen',
      confirmButtonColor: 'var(--accent)'
    });
    if (!name || name.trim() === current || !name.trim()) return;
    await api(`/api/admin/spaces/${spaceId}`, jsonInit('PUT', { name: name.trim() }), 'Space umbenannt.');
  }

  async function deleteSpace(spaceId: number, name: string, recipes: number) {
    const confirmed = await Swal.fire({
      title: `Space „${name}“ löschen?`,
      html: `Das löscht <b>alle ${recipes} Rezepte</b> dieses Spaces inklusive Schritten, Zutaten, Kategorien, Tags und KI-Einstellungen. Mitglieder verlieren den Zugriff (ihre Konten bleiben).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Endgültig löschen',
      confirmButtonColor: 'var(--danger)',
      cancelButtonText: 'Abbrechen'
    });
    if (!confirmed.isConfirmed) return;
    await api(`/api/admin/spaces/${spaceId}`, { method: 'DELETE' }, `Space „${name}“ gelöscht.`);
  }

  async function addMember(spaceId: number, e: Event) {
    const form = e.currentTarget as HTMLFormElement;
    const userPick = form.querySelector<HTMLSelectElement>('select.user-pick');
    const rolePick = form.querySelector<HTMLSelectElement>('select.role-pick');
    const userId = Number(userPick?.value ?? 0);
    const role = (rolePick?.value ?? 'member') as SpaceRole;
    if (!userId) return;
    const ok = await api(
      `/api/admin/spaces/${spaceId}/members`,
      jsonInit('POST', { user_id: userId, role })
    );
    if (ok) form.reset();
  }

  async function removeMember(spaceId: number, userId: number, label: string, spaceName: string) {
    const confirmed = await Swal.fire({
      title: `„${label}“ aus „${spaceName}“ entfernen?`,
      text: 'Das Konto bleibt bestehen — nur der Zugriff auf diesen Space wird entzogen.',
      showCancelButton: true,
      confirmButtonText: 'Entfernen',
      confirmButtonColor: 'var(--danger)',
      cancelButtonText: 'Abbrechen'
    });
    if (!confirmed.isConfirmed) return;
    await api(`/api/admin/spaces/${spaceId}/members/${userId}`, { method: 'DELETE' }, 'Mitglied entfernt.');
  }

  async function changeRole(spaceId: number, userId: number, role: SpaceRole) {
    await api(`/api/admin/spaces/${spaceId}/members/${userId}`, jsonInit('PUT', { role }));
  }

  // Benutzer, die noch in keinem bestimmten Space sind — für den Add-Select
  // (alle außer bestehenden Mitgliedern; der Admin wählt aus allen).
  let anyUser = $derived(data.users);
</script>

<svelte:head>
  <title>Admin – Koch-App</title>
</svelte:head>

<main class="container settings">
  <a href="/" class="back-link"><Icon name="back" size={16} /> Alle Rezepte</a>

  <h1>Verwaltung</h1>
  <p class="dim">
    Benutzer und Spaces verwalten. Benutzerkonten entstehen beim ersten
    Login (Keycloak) oder direkt hier; wer in welchem Space ist, bestimmst du
    über die Mitgliedschaften.
  </p>

  {#if notice}<p class="ok">{notice}</p>{/if}
  {#if errorMsg}<p class="err">{errorMsg}</p>{/if}

  <!-- ===================== Spaces ===================== -->
  <h2 class="section-title"><Icon name="book" size={18} /> Spaces</h2>

  <section class="card">
    <form onsubmit={createSpace} class="add-form">
      <input type="text" placeholder="Neuer Space (z. B. „WG-Küche“)" maxlength="100" aria-label="Neuer Space" />
      <button type="submit" class="btn btn-primary" disabled={busy}>Anlegen</button>
    </form>

    {#each data.spaces as space (space.id)}
      <div class="space">
        <div class="space-head">
          <div>
            <span class="space-name">{space.name}</span>
            <span class="space-meta">{space.recipe_count} Rezepte · {space.members.length} Mitglieder</span>
          </div>
          <div class="space-actions">
            <button type="button" class="btn btn-ghost" disabled={busy} onclick={() => renameSpace(space.id, space.name)}>
              <Icon name="edit" size={15} /> Umbenennen
            </button>
            <button type="button" class="btn btn-danger" disabled={busy} onclick={() => deleteSpace(space.id, space.name, space.recipe_count)}>
              <Icon name="trash" size={15} /> Löschen
            </button>
          </div>
        </div>

        <ul class="members">
          {#each space.members as m (m.user_id)}
            <li class="member">
              <span class="member-name">
                {displayName(m)}
                {#if m.is_active_space}<span class="badge badge-active" title="Aktiver Space dieses Benutzers">aktiv</span>{/if}
                {#if m.role === 'owner'}<span class="badge">owner</span>{/if}
              </span>
              <span class="member-actions">
                <select
                  class="role-select"
                  value={m.role}
                  onchange={(e) => changeRole(space.id, m.user_id, (e.currentTarget as HTMLSelectElement).value as SpaceRole)}
                  disabled={busy}
                  aria-label={`Rolle von ${displayName(m)}`}
                >
                  <option value="member">member</option>
                  <option value="owner">owner</option>
                </select>
                <button
                  type="button"
                  class="btn-remove"
                  disabled={busy}
                  aria-label={`${displayName(m)} entfernen`}
                  onclick={() => removeMember(space.id, m.user_id, displayName(m), space.name)}
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            </li>
          {/each}
          {#if space.members.length === 0}
            <li class="member none">Keine Mitglieder — ohne Mitglied sieht diesen Space niemand im Normalbetrieb.</li>
          {/if}
        </ul>

        <form onsubmit={(e) => addMember(space.id, e)} class="add-member">
          <select class="user-pick" required aria-label="Benutzer wählen" disabled={busy}>
            {#each anyUser as u (u.id)}
              {#if !space.members.some((m) => m.user_id === u.id)}
                <option value={u.id}>{displayName(u)}{u.email ? ` (${u.email})` : ''}</option>
              {/if}
            {/each}
          </select>
          <select class="role-pick" aria-label="Rolle" disabled={busy}>
            <option value="member">member</option>
            <option value="owner">owner</option>
          </select>
          <button type="submit" class="btn" disabled={busy || anyUser.filter((u) => !space.members.some((m) => m.user_id === u.id)).length === 0}>
            Hinzufügen
          </button>
        </form>
      </div>
    {/each}
  </section>

  <!-- ===================== Benutzer ===================== -->
  <h2 class="section-title"><Icon name="users" size={18} /> Benutzer</h2>

  <section class="card">
    {#if data.kcConfigured}
      {#if showCreate}
        <form onsubmit={createUser} class="create-user">
          <div class="grid">
            <label>Benutzername *<input type="text" bind:value={newUsername} required maxlength="100" autocomplete="off" /></label>
            <label>E-Mail<input type="email" bind:value={newEmail} autocomplete="off" /></label>
            <label>Anzeigename<input type="text" bind:value={newName} placeholder="z. B. Anna Beispiel" autocomplete="off" /></label>
            <label>Passwort *<input type="text" bind:value={newPassword} required minlength="6" placeholder="mind. 6 Zeichen" autocomplete="off" /></label>
            <label>
              Space
              <select bind:value={newSpaceId}>
                <option value={0}>— keiner (persönlicher Space beim ersten Login) —</option>
                {#each data.spaces as s (s.id)}
                  <option value={s.id}>{s.name}</option>
                {/each}
              </select>
            </label>
            <label>
              Rolle
              <select bind:value={newRole}>
                <option value="member">member</option>
                <option value="owner">owner</option>
              </select>
            </label>
          </div>
          <p class="dim small">Das Passwort ist temporär — es muss beim ersten Login geändert werden.</p>
          <div class="form-row">
            <button type="submit" class="btn btn-primary" disabled={busy || !newUsername.trim() || newPassword.length < 6}>
              {busy ? '…' : 'Benutzer anlegen'}
            </button>
            <button type="button" class="btn" onclick={() => (showCreate = false)}>Abbrechen</button>
          </div>
        </form>
      {:else}
        <button type="button" class="btn btn-primary" onclick={() => (showCreate = true)} disabled={busy}>
          <Icon name="users" size={16} /> Benutzer erstellen
        </button>
      {/if}
    {:else}
      <p class="empty">
        <Icon name="info" size={16} />
        Benutzer-Erstellung ist nicht konfiguriert — dazu braucht die App einen
        Keycloak-Service-Account mit „manage-users“ (ENV
        <code>KEYCLOAK_ADMIN_CLIENT_ID</code>/<code>KEYCLOAK_ADMIN_CLIENT_SECRET</code>,
        Einrichtung siehe INFRA.md). Spaces und Mitgliedschaften funktionieren
        unabhängig davon; neue Benutzer erscheinen hier nach ihrem ersten Login.
      </p>
    {/if}

    <ul class="users">
      {#each data.users as u (u.id)}
        <li class="user">
          <div class="user-main">
            <span class="user-name">
              {displayName(u)}
              {#if u.is_admin}<span class="badge badge-admin">Admin</span>{/if}
            </span>
            <span class="user-meta">
              {#if u.username && u.username !== displayName(u)}@{u.username} · {/if}
              {#if u.email}{u.email} · {/if}
              letzter Login: {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('de-CH') : 'noch nie'}
            </span>
            <span class="user-spaces">
              {#each u.memberships as ms (ms.space_id)}
                <button
                  type="button"
                  class="chip-space"
                  class:chip-active={u.active_space_id === ms.space_id}
                  title={u.active_space_id === ms.space_id ? 'Aktiver Space — Klick wechselt nicht' : 'Zum aktiven Space dieses Benutzers machen'}
                  disabled={busy || u.active_space_id === ms.space_id}
                  onclick={() => setActiveSpace(u.id, ms.space_id)}
                >
                  {ms.space_name}<span class="chip-role">{ms.role}</span>
                </button>
              {/each}
              {#if u.memberships.length === 0}
                <span class="dim small">kein Space — bekommt beim nächsten Login einen persönlichen</span>
              {/if}
            </span>
          </div>
          <div class="user-actions">
            <button
              type="button"
              class="btn btn-ghost"
              disabled={busy}
              onclick={() => toggleAdmin(u.id, u.is_admin, displayName(u))}
              title={u.is_admin ? 'Admin-Rechte entfernen' : 'Zum App-Admin machen'}
            >
              <Icon name={u.is_admin ? 'lock' : 'users'} size={15} />
              {u.is_admin ? 'Admin entfernen' : 'Admin'}
            </button>
          </div>
        </li>
      {/each}
    </ul>
  </section>
</main>

<style>
  .settings {
    padding-top: 16px;
    padding-bottom: 40px;
  }
  h1 {
    font-size: 1.35rem;
    margin: 14px 0 0;
  }
  h2.section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.05rem;
    margin: 26px 0 10px;
    color: var(--text);
  }
  .dim {
    color: var(--dim);
  }
  .small {
    font-size: 0.85rem;
  }
  .card {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px;
    margin-bottom: 16px;
  }
  .ok {
    color: #6fcf97;
    margin: 0 0 12px;
  }
  .err {
    color: var(--danger);
    margin: 0 0 12px;
  }
  .empty {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: var(--dim);
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
  }
  .empty code {
    color: var(--accent);
    font-size: 0.8rem;
  }

  /* Forms */
  .add-form {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
  }
  .add-form input {
    flex: 1;
    min-width: 0;
    min-height: var(--tap);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 1rem;
  }
  .add-form input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .create-user {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .create-user .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
  }
  .create-user label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.85rem;
    color: var(--dim);
  }
  .create-user input,
  .create-user select {
    min-height: var(--tap);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 1rem;
  }
  .create-user input:focus,
  .create-user select:focus {
    outline: none;
    border-color: var(--accent);
  }
  .form-row {
    display: flex;
    gap: 8px;
  }

  /* Spaces */
  .space {
    border-top: 1px solid var(--border);
    margin-top: 16px;
    padding-top: 14px;
  }
  .space-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    flex-wrap: wrap;
  }
  .space-name {
    font-weight: 600;
    font-size: 1.05rem;
  }
  .space-meta {
    display: block;
    color: var(--dim);
    font-size: 0.85rem;
    margin-top: 2px;
  }
  .space-actions {
    display: flex;
    gap: 8px;
  }
  .members {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .member {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .member.none {
    color: var(--dim);
    font-size: 0.85rem;
    border-style: dashed;
  }
  .member-name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 0;
  }
  .member-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .role-select {
    min-height: 36px;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font-size: 0.85rem;
  }
  .btn-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: var(--dim);
    cursor: pointer;
  }
  .btn-remove:hover:not(:disabled) {
    background: rgba(255, 92, 92, 0.15);
    color: var(--danger);
  }
  .add-member {
    display: flex;
    gap: 6px;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  .add-member select {
    flex: 1;
    min-width: 140px;
    min-height: var(--tap);
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 0.9rem;
  }
  .add-member .role-pick {
    flex: 0 0 100px;
  }

  /* Badges & Chips */
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--surface-3);
    color: var(--text-dim);
    font-size: 0.72rem;
    font-weight: 600;
  }
  .badge-admin {
    background: rgba(255, 122, 61, 0.18);
    color: var(--accent);
  }
  .badge-active {
    background: rgba(111, 207, 151, 0.16);
    color: #6fcf97;
  }
  .chip-space {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 0.8rem;
    cursor: pointer;
  }
  .chip-space.chip-active {
    border-color: rgba(111, 207, 151, 0.5);
    cursor: default;
  }
  .chip-space:disabled {
    cursor: default;
    opacity: 0.9;
  }
  .chip-role {
    color: var(--dim);
    font-size: 0.7rem;
  }

  /* Users */
  .users {
    list-style: none;
    margin: 14px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .user {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    flex-wrap: wrap;
  }
  .user-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }
  .user-name {
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .user-meta {
    color: var(--dim);
    font-size: 0.8rem;
  }
  .user-spaces {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 2px;
  }
  .user-actions {
    flex-shrink: 0;
  }

  .btn-ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
  }
  .btn-danger {
    background: transparent;
    border: 1px solid rgba(255, 92, 92, 0.4);
    color: var(--danger);
  }
  .btn-danger:hover:not(:disabled) {
    background: rgba(255, 92, 92, 0.12);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
</style>
