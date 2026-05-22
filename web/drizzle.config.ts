import { defineConfig } from 'drizzle-kit';

import { DATABASE_URL } from './src/db/constants';

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: DATABASE_URL,
    },
});
