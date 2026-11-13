/** Focused proposal/source regressions only. No SQL parser/compile/PG execution. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=new URL('../supabase/proposals/core-listing-ownership-revision-v1.sql',import.meta.url);
const original=readFileSync(file,'utf8');
function check(source){
 assert.match(source,/RAISE EXCEPTION 'core_listing_revision_adoption_not_admitted' USING ERRCODE='55000'/);
 assert.match(source,/ROLLBACK;\s*$/);
 const sql=source.replace(/--[^\n]*/g,'');
 assert.match(sql,/ADD COLUMN native_revision_v1 bigint;/);
 assert.doesNotMatch(sql,/CREATE TABLE|DEFAULT\s+1|UPDATE portfolio\.ownerships SET|GRANT\s|CREATE POLICY|DISABLE TRIGGER/i);
 assert.match(sql,/OLD\.native_revision_v1 IS NOT NULL/);
 assert.match(sql,/NEW\.native_revision_v1 IS DISTINCT FROM OLD\.native_revision_v1/);
 assert.match(sql,/NEW\.native_revision_v1:=OLD\.native_revision_v1\+1/);
 assert.match(sql,/to_jsonb\(NEW\)-'native_revision_v1'/);
 assert.match(sql,/SECURITY INVOKER SET search_path=pg_catalog/);
 assert.ok('customer_ownership_integrity'<'zz_core_listing_ownership_revision_v1');
 for(const table of ['portfolio.ownerships','portfolio.parties','identity.membership_parties']){
  assert.ok(sql.includes(`BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON ${table}\n FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_canonical_authority_revision_v1()`));
  assert.ok(sql.includes(`ALTER TABLE ${table} ENABLE ALWAYS TRIGGER aa_core_listing_epoch_v1`));
 }
 return true;
}
assert.equal(check(original),true);console.log('PASS exact guarded source: same-table nullable revision, canonical BEFORE-statement epoch, closed authority');
const negatives=[
 ['fake historical version',s=>s.replace('ADD COLUMN native_revision_v1 bigint;','ADD COLUMN native_revision_v1 bigint DEFAULT 1;')],
 ['unversioned row silently adopted',s=>s.replace('OLD.native_revision_v1 IS NOT NULL','true')],
 ['caller overrides revision',s=>s.replace('NEW.native_revision_v1 IS DISTINCT FROM OLD.native_revision_v1','false')],
 ['epoch lock after row wait',s=>s.replace('BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON portfolio.ownerships','AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON portfolio.ownerships')],
 ['missing membership invalidation',s=>s.replace('ON identity.membership_parties\n FOR EACH STATEMENT','ON identity.memberships\n FOR EACH STATEMENT')],
 ['trigger disabled in replica',s=>s.replace('ENABLE ALWAYS TRIGGER aa_core_listing_epoch_v1','ENABLE TRIGGER aa_core_listing_epoch_v1')],
 ['lost guard',s=>s.replace("USING ERRCODE='55000'","USING ERRCODE='00000'")],
 ['automatic activation',s=>s.replace('ROLLBACK;','COMMIT;')],
 ['parallel registry',s=>s+'\nCREATE TABLE platform.relationship_versions(id uuid);\nROLLBACK;'],
];
for(const [name,mutate]of negatives){assert.throws(()=>check(mutate(original)),undefined,name);console.log('PASS negative '+name);}
console.log(JSON.stringify({task:'CORE-DOMAIN-PORTS-01/Listing-revision-continuation',source_controls:10,sql_parser_compile_pg:'NOT_RUN_NOT_PASS',canonical_companion:'NOT_READY',activation:null}));
