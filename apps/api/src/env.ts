import { resolve } from 'node:path';

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
}

export const env = {
    databaseUrl: required('DATABASE_URL'),
    port: Number(process.env.PORT ?? 3001),
    webDist: resolve(process.env.WEB_DIST ?? '../web/dist'),
    migrationsDir: resolve(process.env.MIGRATIONS_DIR ?? '../../db/migrations'),
};
