import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { generalRoutes } from './general';

export const dynamic = 'force-dynamic';

const app = new Hono().basePath('/api');

app.route('/', generalRoutes);

export const GET = handle(app);
