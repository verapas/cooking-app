import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Konsultiert den Vite-Server-Config für Preprocessing (TypeScript etc.)
  preprocess: vitePreprocess(),
  kit: {
    // adapter-node: läuft als normaler Node-Prozess — ideal für Proxmox/Docker.
    adapter: adapter(),
  },
};

export default config;
