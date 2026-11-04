import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { SQL } from 'bun';

/**
 * Applies pending `db/migrations/*.sql` files in name order, each in its own
 * transaction, and records them in `schema_migrations`.
 */
export async function migrate(sql: SQL, migrationsDir: string) {
    await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;

    const applied = new Set(
        (await sql`SELECT name FROM schema_migrations`).map(
            (row: { name: string }) => row.name
        )
    );
    const files = (await readdir(migrationsDir))
        .filter((file) => file.endsWith('.sql'))
        .toSorted();

    for (const file of files) {
        if (applied.has(file)) continue;
        const body = await Bun.file(join(migrationsDir, file)).text();
        await sql.begin(async (tx) => {
            await tx.unsafe(body);
            await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
        });
        console.info(`migration applied: ${file}`);
    }
}
