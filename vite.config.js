import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'רכבי 7 מקומות',
        short_name: 'רכבי 7 מקומות',
        description: 'קטלוג רכבי 7 מקומות למשפחה',
        lang: 'he',
        dir: 'rtl',
        theme_color: '#1e3a8a',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // גופנים — מטמון קודם
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // קטלוג הרכבים מ-Google Sheets — תמיד רשת, מטמון כגיבוי
            urlPattern: /^https:\/\/docs\.google\.com\/spreadsheets\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cars-catalog',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 10 },
            },
          },
          {
            // תמונות רכבים — מטמון קודם
            urlPattern: /\.(?:png|jpg|jpeg|webp|gif)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'car-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
