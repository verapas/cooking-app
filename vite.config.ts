import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png', 'robots.txt'],
      // Icon-Cache-Busting: Chrome/Android cachen Manifest-Icons hart per
      // URL — gleiche URL + neuer Inhalt = altes Icon bleibt auf dem
      // Homescreen. Bei jedem Icon-Wechsel ICON_VERSION hochzählen, damit
      // die URLs neu sind und Chrome die Icons zwingend neu lädt.
      manifest: {
        name: 'Koch-App',
        short_name: 'Koch-App',
        description: 'Mobile-first Kochrezept-App',
        theme_color: '#15110d',
        background_color: '#15110d',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192.png?v=2',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png?v=2',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        start_url: '/',
        categories: ['food', 'cooking'],
        shortcuts: [
          {
            name: 'Alle Rezepte',
            short_name: 'Rezepte',
            description: 'Alle Rezepte anzeigen',
            url: '/',
            icons: [{ src: '/icon-192.png?v=2', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https?.+\.(png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-resources'
            }
          },
          {
            // Rezept-Detailseiten (NetworkFirst: frisch wenn online,
            // letzter Stand aus dem Cache bei Timeout/Offline).
            urlPattern: /\/recipe\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'recipes-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 7 * 24 * 60 * 60
              }
            }
          }
        ],
        navigateFallback: '/offline',
        navigateFallbackDenylist: [/^\/api/, /^\/images/]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ]
});