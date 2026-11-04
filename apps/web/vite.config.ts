import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:3001';

export default defineConfig({
    plugins: [
        tanstackRouter({ target: 'react', autoCodeSplitting: true }),
        react(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'script-defer',
            // public/manifest.webmanifest is the manifest.
            manifest: false,
            workbox: {
                globPatterns: ['**/*.{js,css,html,woff2,png,webp,ico}'],
                // Turkish text never needs these Geist subsets.
                globIgnores: ['**/geist-{cyrillic,cyrillic-ext,vietnamese}-*'],
                // The maplibre chunk is ~1 MB.
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api\//],
                runtimeCaching: [
                    {
                        // The live list: fresh when online, last copy when not.
                        urlPattern: ({ url }) =>
                            url.pathname === '/api/duties' && !url.search,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'duties',
                            networkTimeoutSeconds: 5,
                            expiration: {
                                maxEntries: 1,
                                maxAgeSeconds: 2 * 24 * 3600,
                            },
                        },
                    },
                    {
                        urlPattern: ({ url }) =>
                            url.origin === 'https://api.maptiler.com' &&
                            !url.pathname.includes('/tiles/'),
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'map-style',
                            expiration: {
                                maxEntries: 120,
                                maxAgeSeconds: 30 * 24 * 3600,
                            },
                        },
                    },
                    {
                        // Recently viewed map tiles, so the area around the
                        // user still draws without a connection.
                        urlPattern: ({ url }) =>
                            url.origin === 'https://api.maptiler.com' &&
                            url.pathname.includes('/tiles/'),
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'map-tiles',
                            expiration: {
                                maxEntries: 600,
                                maxAgeSeconds: 7 * 24 * 3600,
                            },
                            cacheableResponse: { statuses: [200] },
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
        target: 'es2022',
        // maplibre alone is ~1 MB; it lives in its own chunk below.
        chunkSizeWarningLimit: 1200,
        rolldownOptions: {
            output: {
                // maplibre changes rarely; keep it in its own long-cached
                // chunk instead of busting it with every app change.
                codeSplitting: {
                    groups: [
                        {
                            name: 'maplibre',
                            test: /node_modules[\\/].*maplibre-gl/,
                        },
                    ],
                },
            },
        },
    },
    server: {
        proxy: {
            '/api': API_ORIGIN,
            // The MapTiler key only accepts the production origin. Dev builds
            // rewrite MapTiler URLs to this proxy (see lib/map-style.ts).
            '/maptiler': {
                target: 'https://api.maptiler.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/maptiler/, ''),
                headers: { Referer: 'https://nobetcim.app/' },
            },
        },
    },
});
