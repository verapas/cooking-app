import { error } from '@sveltejs/kit';
import { listAdminSpaces, listAdminUsers, requireAdmin } from '$lib/server/admin';
import { keycloakAdminConfigured } from '$lib/server/keycloakAdmin';
import type { PageServerLoad } from './$types';

// /admin — Benutzerverwaltung (nur App-Admins). Nicht-Admins bekommen 403.
export const load: PageServerLoad = async ({ locals }) => {
  const me = requireAdmin(locals);
  return {
    me: { id: me.id },
    users: await listAdminUsers(),
    spaces: await listAdminSpaces(),
    kcConfigured: keycloakAdminConfigured()
  };
};
