import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Muss zum Namen des GitHub-Repositorys passen (https://<user>.github.io/<repo>/).
const BASE = '/strom-controlling/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Strom-Controlling',
        short_name: 'Strom',
        description: 'Balkon-PV und Stromzähler auswerten: Erzeugung, Eigenverbrauch, Ersparnis.',
        lang: 'de',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#050816',
        theme_color: '#050816',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
