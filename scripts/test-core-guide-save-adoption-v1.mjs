/** New source invariants, not SQL compile/PG/Auth/install proof. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {guideSaveAdoptionSqlV1,guideSaveCanonicalBodyV1,checkGuideSaveAdoptionSqlV1,GUIDE_SAVE_SOURCE_SHA256} from './prepare-core-guide-save-adoption-v1.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),source=readFileSync('supabase/proposals/ce012_save_writer_relation_v1.sql','utf8'),sql=readFileSync('supabase/install/guide-no-document-v1/20-save-relation.sql','utf8');
assert.equal(sha(source),GUIDE_SAVE_SOURCE_SHA256);assert.ok(source.includes("raise exception 'ce012_save_writer_review_only'"));assert.match(source,/rollback;\n$/);
assert.equal(sql,guideSaveAdoptionSqlV1());assert.equal(checkGuideSaveAdoptionSqlV1(sql),true);
assert.ok(guideSaveCanonicalBodyV1().includes('deferrable initially deferred'));
let n=1;console.log('PASS1 exact canonical table/functions/constraints retained, historical55000 proposal unchanged');
for(const [name,mutate]of [
 ['deferred check changed',s=>s.replace('deferrable initially deferred','not deferrable')],
 ['receipt/command relation weakened',s=>s.replace("or p->>'mutation_id' is distinct from new.mutation_id::text",'or false')],
 ['canonical delimiter damaged',s=>s.replace('end $$;','end $;')],
 ['deadline removed',s=>s.replace("SET LOCAL lock_timeout='5s';",'')],
 ['collision stop removed',s=>s.replace('guide_save_adoption_collision_stop','silently_reuse')],
 ['PUBLIC positive grant',s=>s.replace('COMMIT;','GRANT SELECT ON experience.guide_save_receipts_v1 TO PUBLIC;\nCOMMIT;')],
 ['private executor ALL grant',s=>s.replace('COMMIT;','GRANT ALL ON experience.guide_save_receipts_v1 TO cladora_ce_guide_executor;\nCOMMIT;')],
 ['missing json target becomes SQL NULL accepted',s=>s.replace("IS NOT DISTINCT FROM 'null'::jsonb","= 'null'::jsonb")],
 ['immutable lock policy weakened',s=>s.replace(') WITH CHECK(false);',') WITH CHECK(true);')],
]){const changed=mutate(sql);assert.notEqual(changed,sql);const coherentlyResealed={bytes:Buffer.byteLength(changed),sha256:sha(changed)};assert.equal(coherentlyResealed.sha256,sha(changed));assert.throws(()=>checkGuideSaveAdoptionSqlV1(changed));console.log('PASS'+(++n)+' rejects coherent '+name);}
console.log(JSON.stringify({task:'CORE-DOMAIN-PORTS-01/Guide-adoption-preparation',source_groups:n,native:'NOT_RUN_NOT_PASS',complete_target_installer:'SOURCE_PACKET_NATIVE_NOT_RUN'}));
