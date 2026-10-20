// Siehe https://svelte.dev/docs/kit/types#app.d.ts
// für Informationen über diese Interfaces
import type { SessionUser } from '$lib/types';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      /** Angemeldeter Benutzer (OIDC/Keycloak) oder null — gesetzt in
       *  hooks.server.ts aus der DB-Session. */
      user: SessionUser | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
