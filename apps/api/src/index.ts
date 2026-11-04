import { app } from './app';
import { sql } from './db/client';
import { migrate } from './db/migrate';
import { env } from './env';

await migrate(sql, env.migrationsDir);

const server = Bun.serve({
    port: env.port,
    hostname: '0.0.0.0',
    fetch: app.fetch,
});
console.info(`listening on :${server.port}`);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, async () => {
        await server.stop();
        await sql.close();
        process.exit(0);
    });
}
