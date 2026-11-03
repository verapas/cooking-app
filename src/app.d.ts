// Siehe https://svelte.dev/docs/kit/types#app.d.ts
// für Informationen über diese Interfaces
import type { ActiveSpace, SessionUser } from '$lib/types';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      /** Angemeldeter Benutzer (OIDC/Keycloak) oder null — gesetzt in
       *  hooks.server.ts aus der DB-Session. */
      user: SessionUser | null;
      /** Aktiver Space des Benutzers oder null (ohne Login) — Scope für
       *  alle Daten-Queries. Wird in hooks.server.ts aufgelöst; beim
       *  Erstlogin provisioniert resolveActiveSpace einen persönlichen
       *  Space, daher ist space immer gesetzt, wenn user gesetzt ist. */
      space: ActiveSpace | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
