import { readFileSync, readdirSync } from 'node:fs';
import { summarizeFailure } from './lib/local-supabase-failure-summary.mjs';
const log = readFileSync(process.argv[2], 'utf8');
const migrations = readdirSync(new URL('../supabase/migrations/', import.meta.url));
console.error(JSON.stringify(summarizeFailure(log, migrations)));
