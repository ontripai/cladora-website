import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GET} from '../src/app/api/internal/export-scanner/mock-preview/route.ts';

const migration=fs.readFileSync('supabase/migrations/20260914114546_export_scanner_worker_gateway.sql','utf8');
const pgTap=fs.readFileSync('supabase/tests/084_export_scanner_worker_gateway.test.sql','utf8');
const route=fs.readFileSync('src/app/api/internal/export-scanner/mock-preview/route.ts','utf8');
for(const name of ['claim','fail','complete'])assert.match(migration,new RegExp(`public\\.${name}_export_artifact_scan_job_worker_v1`));
assert.match(migration,/security invoker/g);assert.match(migration,/to service_role/g);assert.doesNotMatch(migration,/to authenticated|to anon/i);
assert.match(pgTap,/select plan\(22\)/);assert.match(route,/VERCEL_ENV!=='preview'/);assert.match(route,/timingSafeEqual/);assert.match(route,/EXPORT_SCANNER_MOCK_PREVIEW_ENABLED/);assert.match(route,/no-store, private/);assert.match(route,/synthetic-preview/);assert.doesNotMatch(route,/createClient|SUPABASE_SERVICE_ROLE_KEY/i);
assert.equal(fs.existsSync('vercel.json'),false,'Preview-only work must not configure a Production Cron schedule');

const saved={...process.env};
const call=(authorization)=>GET(new Request('https://preview.cladora.test/api/internal/export-scanner/mock-preview',{headers:authorization?{authorization}:{}}));
try{
  process.env.VERCEL_ENV='production';let response=await call();assert.equal(response.status,404);
  process.env.VERCEL_ENV='preview';delete process.env.CRON_SECRET;response=await call();assert.equal(response.status,503);assert.equal((await response.json()).error.code,'PREVIEW_RUNTIME_NOT_CONFIGURED');
  process.env.CRON_SECRET='x'.repeat(32);response=await call('Bearer wrong');assert.equal(response.status,401);
  response=await call(`Bearer ${process.env.CRON_SECRET}`);assert.equal(response.status,503);assert.equal((await response.json()).error.code,'MOCK_PREVIEW_DISABLED');
  process.env.EXPORT_SCANNER_MOCK_PREVIEW_ENABLED='true';response=await call(`Bearer ${process.env.CRON_SECRET}`);assert.equal(response.status,200);assert.deepEqual(await response.json(),{mode:'synthetic_mock_preview',completed:true,result:'completed'});assert.equal(response.headers.get('cache-control'),'no-store, private');
}finally{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
console.log('CLADORA-P2-EXPORT-SCANNER-RUNTIME-001A: Migration 97, Preview fail-closed route and Mock PASS.');
