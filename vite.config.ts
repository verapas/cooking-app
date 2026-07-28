import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// SvelteKit nutzt Vite als Bundler. Das Plugin stellt Routing,
// SSR und Server-Routen bereit.
export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // Im lokalen Netzwerk von anderen Geräten (Handy) erreichbar.
    host: true,
  },
});
