import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

import { DATABASE_URL } from './constants';

const migrationsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../db/migrations'
);

async function migrate() {
    const pool = new Pool({ connectionString: DATABASE_URL });
    const files = readdirSync(migrationsDir)
        .filter((file) => file.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const sql = readFileSync(join(migrationsDir, file), 'utf8');
        await pool.query(sql);
        console.log(`Applied ${file}`);
    }

    await pool.end();
    console.log('Migration complete');
}

migrate().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
