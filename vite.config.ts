import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'brand/*.svg'],
      manifest: {
        id: '/app',
        name: 'FindBox',
        short_name: 'FindBox',
        description: 'School lost & found. Register belongings, report a loss, get matched, collect safely.',
        start_url: '/app/sign-in?source=homescreen',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f5f5',
        theme_color: '#0d6166',
        lang: 'en',
        categories: ['education', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Report lost', url: '/app/report', description: 'Report a registered item lost' },
          { name: 'Found Items Gallery', url: '/app/gallery' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'icons/*.png', 'media/catalog/*.webp', 'media/products/*.webp'],
        globIgnores: ['**/three-engine-*.js', '**/scene-*.js', '**/Landing-*.js', '**/charts-*.js', '**/scan-*.js', '**/Dashboard-*.js', '**/StudioShader-*.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/assets\//, /^\/media\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          { urlPattern: ({ request, sameOrigin }) => sameOrigin && ['script', 'style'].includes(request.destination), handler: 'CacheFirst', options: { cacheName: 'findbox-code-v2', expiration: { maxEntries: 70, maxAgeSeconds: 30 * 24 * 60 * 60 }, cacheableResponse: { statuses: [200] } } },
          { urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'image', handler: 'CacheFirst', options: { cacheName: 'findbox-images-v2', expiration: { maxEntries: 70, maxAgeSeconds: 30 * 24 * 60 * 60 }, cacheableResponse: { statuses: [200] } } },
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id) || id.includes('commonjsHelpers')) return 'app-runtime'
          if (/node_modules\/(three|@react-three|three-stdlib|maath|meshline|camera-controls|@use-gesture|react-reconciler|its-fine|suspend-react|zustand\/traditional|@monogrid|@mediapipe|troika-|bidi-js|stats-gl|stats.js)/.test(id)) return 'three-engine'
          if (id.includes('/node_modules/recharts/')) return 'charts'
          if (id.includes('/node_modules/jsqr/')) return 'scan'
          if (id.includes('/node_modules/qrcode/')) return 'qr'
        },
      },
    },
  },
})
