import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';

import { env } from '../env';
import * as schema from './schema';

export const sql = new SQL({ url: env.databaseUrl, max: 10 });
export const db = drizzle({ client: sql, schema });
