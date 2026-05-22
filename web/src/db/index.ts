import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { DATABASE_URL } from './constants';
import * as schema from './schema';

const globalForDb = globalThis as typeof globalThis & {
    pool?: Pool;
};

function getPool(): Pool {
    if (!globalForDb.pool) {
        globalForDb.pool = new Pool({
            connectionString: DATABASE_URL,
            max: 10,
        });
    }

    return globalForDb.pool;
}

export const db = drizzle(getPool(), { schema });
