import { browser } from '$app/environment';

export const auth = $state({ isLoggedIn: false });

async function checkAuth() {
  if (!browser) return;
  try {
    const res = await fetch('/api/auth/verify', { credentials: 'include' });
    auth.isLoggedIn = res.ok;
  } catch {
    auth.isLoggedIn = false;
  }
}

if (browser) {
  checkAuth();
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  auth.isLoggedIn = false;
}

export async function refreshAuth(): Promise<void> {
  await checkAuth();
}