import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';

import { sql } from './db/client';
import { env } from './env';
import { dutyRoutes } from './routes/duties';

const MAP_HOSTS = ['https://api.maptiler.com'];
const ANALYTICS_HOST = 'https://api.invisit.dev';
const REVALIDATE = /(\.html|\/sw\.js|\/registerSW\.js|\.webmanifest)$/;

const api = new Hono()
    .route('/', dutyRoutes)
    .get('/health', async (c) => {
        await sql`SELECT 1`;
        return c.json({ ok: true });
    })
    .onError((error, c) => {
        console.error('api error', error);
        return c.json({ error: 'internal error' }, 500);
    });

export const app = new Hono()
    .use(
        secureHeaders({
            contentSecurityPolicy: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", ANALYTICS_HOST],
                styleSrc: ["'self'", "'unsafe-inline'"],
                fontSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'blob:', ...MAP_HOSTS],
                connectSrc: ["'self'", ...MAP_HOSTS, ANALYTICS_HOST],
                workerSrc: ["'self'", 'blob:'],
                frameAncestors: ["'self'"],
            },
            permissionsPolicy: {
                camera: [],
                microphone: [],
                geolocation: ['self'],
            },
            crossOriginEmbedderPolicy: false,
        })
    )
    .use(compress())
    .route('/api', api)
    .all('/api/*', (c) => c.json({ error: 'not found' }, 404))
    .use(
        '/assets/*',
        serveStatic({
            root: env.webDist,
            onFound: (_path, c) => {
                c.header(
                    'Cache-Control',
                    'public, max-age=31536000, immutable'
                );
            },
        })
    )
    .use(
        '*',
        serveStatic({
            root: env.webDist,
            onFound: (path, c) => {
                c.header(
                    'Cache-Control',
                    // Entry points must revalidate so new deploys reach users.
                    REVALIDATE.test(path) ? 'no-cache' : 'public, max-age=3600'
                );
            },
        })
    )
    // SPA fallback: every other path renders the app, which shows its own 404.
    .get(
        '*',
        serveStatic({
            path: 'index.html',
            root: env.webDist,
            onFound: (_path, c) => {
                c.header('Cache-Control', 'no-cache');
            },
        })
    );
