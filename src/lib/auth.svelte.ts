// === Client-seitiger Admin-Auth-Status ===
// Speichert den API-Token (nach erfolgreicher Verifikation) dauerhaft im
// localStorage. Damit kann man Bilder hochladen, ohne sich jedes Mal neu
// einzuloggen. Der Token ist derselbe wie COOKING_API_TOKEN auf dem Server.

import { browser } from '$app/environment';

const KEY = 'cook_admin_token';

export const auth = $state({ token: '' });

// Beim Laden im Browser einen evtl. gespeicherten Token wiederherstellen.
if (browser) {
  auth.token = localStorage.getItem(KEY) ?? '';
}

export const isLoggedIn = () => auth.token !== '';

export function setToken(token: string): void {
  auth.token = token;
  if (browser) {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  }
}

export function logout(): void {
  setToken('');
}
