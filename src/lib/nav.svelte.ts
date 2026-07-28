// Drawer-State (Svelte 5 universal reactivity – in .svelte.ts nutzbar).
// Wird von TopBar (Burger) und NavDrawer geteilt.
export const nav = $state({ open: false });

export function openDrawer(): void {
  nav.open = true;
}

export function closeDrawer(): void {
  nav.open = false;
}

export function toggleDrawer(): void {
  nav.open = !nav.open;
}
