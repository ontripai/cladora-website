/** Text/source/model only, no SQL parser/PG. */
import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
const dir='supabase/proposals/core-listing-party-revision-v1/',pins=JSON.parse(read(dir+'writer-pins.json')),delta=read(dir+'delta.sql'),source=read(pins.sourcePath);
assert.equal(sha(source),pins.source_sha256);
const barrier=/ -- CORE_LISTING_SOURCE_BARRIER16_BEGIN[\s\S]*? -- CORE_LISTING_SOURCE_BARRIER16_END\n/g;
function verify(text){for(const p of pins.routines){const re=new RegExp('create or replace function customer_api\\.'+p.name+'\\([\\s\\S]*?\\$\\$;'),before=re.exec(source)?.[0],after=re.exec(text)?.[0];assert.ok(before&&after);assert.equal(sha(before),p.before_definition_sha256);assert.equal(sha(after),p.after_definition_sha256);assert.equal(after.replace(barrier,''),before);assert.ok(after.indexOf('CORE_LISTING_SOURCE_BARRIER16_BEGIN')<after.toLowerCase().indexOf(' for update'));}}
verify(delta);assert.throws(()=>verify(delta.replace('as $$','as $')));assert.throws(()=>verify(delta.replace('where singleton for update','where singleton for share')));
assert.match(delta,/RAISE EXCEPTION 'listing_companion_adoption_required'/);assert.doesNotMatch(delta,/UPDATE\s+portfolio\.(parties|ownerships)\s+SET\s+native_revision_v1/i);assert.match(delta,/native_revision_v1 IS NULL OR/);assert.doesNotMatch(delta,/^\s*(GRANT|REVOKE|ALTER.*OWNER TO)\b/gmi);
const query=read('src/lib/core/listing-ownership-companion-queries-v1.ts');assert.ok(query.includes('s.unit_code::text as resource_label'));assert.ok(!query.includes('legal_name'));assert.ok(query.includes('mp.membership_id=$4::uuid'));assert.ok(query.includes('g.unit_id=u.id'));assert.ok(query.includes('limit 101'));assert.ok(query.includes('p[3]!==bound.membership_id'));
const adoption=read('src/lib/core/listing-ownership-adoption-query-v1.ts');for(const f of pins.routines)assert.ok(adoption.includes(f.after_body_sha256));assert.ok(adoption.includes("t.tgqual is null"));
console.log(JSON.stringify({named_writer_roundtrips:2,corruption_negatives:2,no_backfill_or_privilege_widening:'PASS',new_source_scope_checks:'PASS',global_writer_coverage:'NOT_PROVEN',SQL_parser:false,SQL_execution:false,native:'NOT_RUN_NOT_PASS'}));
