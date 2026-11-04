import { env } from '../env';
import { sql } from './client';
import { migrate } from './migrate';

await migrate(sql, env.migrationsDir);
await sql.close();
