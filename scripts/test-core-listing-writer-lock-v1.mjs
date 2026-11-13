/** New SOURCE/model controls only; no SQL parser, PG, credentials or target. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build,BLOCK,outputs,normalizeHeader,ROOT} from './prepare-core-listing-writer-lock-v1.mjs';
const rows=build();let n=0;
function check(name,fn){fn();console.log(`PASS ${++n} ${name}`);}
function exact(row,definition){
 assert.equal(definition.split(BLOCK).length,2,'exactly one entry barrier');
 const restored=normalizeHeader(definition.split(BLOCK).join(''));
 // Independent full definition equality; no prosrc-only/header/delimiter exception.
 assert.equal(restored,normalizeHeader(row.before));
 assert.equal((definition.match(/\$\$/g)||[]).length,(row.before.match(/\$\$/g)||[]).length);
 assert.equal(definition.indexOf(BLOCK),definition.search(/\bbegin\b/i)+5);
 assert.match(BLOCK,/where singleton for update;/);
 assert.match(BLOCK,/if not found then[\s\S]*errcode='55000'/);
 assert.doesNotMatch(BLOCK,/\bupdate\s+app_private|set_config|GRANT|SECURITY/i);
}
for(const row of rows)check('minimal exact roundtrip '+row.name,()=>exact(row,row.after));
check('all generated artifacts exact and read-only preflight/verify bounded',()=>{
 for(const[path,sql]of Object.entries(outputs(rows))){assert.equal(readFileSync(ROOT+path,'utf8'),sql);assert.ok(sql.indexOf('lock_timeout')<sql.indexOf('FROM pg_'));}
 const sql=outputs(rows)['supabase/proposals/core-listing-writer-lock-v1/delta.sql'];
 assert.match(sql,/RAISE EXCEPTION 'core_listing_writer_adoption_not_admitted' USING ERRCODE='55000'/);assert.match(sql,/ROLLBACK;\s*$/);
 assert.match(sql,/listing_writer_metadata_changed/);assert.match(sql,/pg_has_role\(current_user,p.proowner,'USAGE'\)/);
 assert.match(sql,/listing_writer_epoch_privilege_or_rls_not_proven/);assert.match(sql,/listing_writer_metadata_unbound/);
 const body=sql.replace(/--[^\n]*/g,'');assert.doesNotMatch(body,/\bGRANT\s|ALTER\s+ROLE|ALTER\s+POLICY|OWNER\s+TO|CREATE\s+TABLE\s+(portfolio|platform)\./i);
});
// Exhaustive interleavings of a SCOPED two-actor lock model, never PG proof.
// Locks held until terminal settlement; every blocked edge retains earlier locks.
function cycles(programs){let dead=0,terminal=0;
 const seen=new Set();
 function dfs(pcs,held){const key=JSON.stringify([pcs,held]);if(seen.has(key))return;seen.add(key);let progress=false;
  for(let a=0;a<programs.length;a++){
   if(pcs[a]>programs[a].length)continue;
   const next=programs[a][pcs[a]];
   if(!next){progress=true;const p=pcs.slice();p[a]++;dfs(p,held.filter(h=>h.a!==a));continue;}
   const [r,mode]=next;if(held.some(h=>h.a!==a&&h.r===r&&(mode==='X'||h.mode==='X')))continue;
   progress=true;const p=pcs.slice();p[a]++;dfs(p,[...held,{a,r,mode}]);
  }
  if(!progress){if(pcs.every((p,i)=>p>programs[i].length))terminal++;else dead++;}
 }
 dfs(programs.map(()=>0),[]);return{dead,terminal};
}
for(const resource of ['property','unit','import_run','invitation'])check('old cycle / entry barrier removes scoped cycle '+resource,()=>{
 const reader=[['epoch','S'],[resource,'S']],old=[[resource,'X'],['epoch','X']],fixed=[['epoch','X'],[resource,'X']];
 assert.ok(cycles([reader,old]).dead>0);const r=cycles([reader,fixed]);assert.equal(r.dead,0);assert.ok(r.terminal>0);
});
check('approval omission still cycles despite corrected inner commit',()=>{
 const reader=[['epoch','S'],['import_run','S']],bad=[['import_run','X'],['epoch','X'],['epoch','X']],fixed=[['epoch','X'],['import_run','X'],['epoch','X']];
 assert.ok(cycles([reader,bad]).dead>0);assert.equal(cycles([reader,fixed]).dead,0);
 assert.ok(rows.some(r=>r.name==='app_private.onboarding_approve_import_commit_internal_v1'));
 assert.ok(rows.some(r=>r.name==='customer_api.claim_unit_invitation_v1'));
});
check('two writer entries serialize before rows; same transaction recursive barrier is reentrant',()=>{
 assert.equal(cycles([[['epoch','X'],['unit','X']],[['epoch','X'],['unit','X']]]).dead,0);
 assert.equal(cycles([[['epoch','X'],['import_run','X'],['epoch','X']],[['epoch','S'],['import_run','S']]]).dead,0);
});
check('revision proposal unchanged: NULL history and all three canonical invalidators retained',()=>{
 const sql=readFileSync(ROOT+'supabase/proposals/core-listing-ownership-revision-v1.sql','utf8');
 assert.match(sql,/OLD.native_revision_v1 IS NOT NULL/);assert.doesNotMatch(sql,/ADD COLUMN native_revision_v1 bigint DEFAULT/);
 for(const t of ['portfolio.ownerships','portfolio.parties','identity.membership_parties'])assert.ok(sql.includes('BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON '+t));
});
for(const[name,change]of[
 ['late barrier',r=>r.after.replace(BLOCK,'')+BLOCK],
 ['changed security',r=>r.after.replace(/security definer/i,'security invoker')],
 ['delimiter corruption',r=>r.after.replaceAll('$$','$')],
 ['changed authorization',r=>r.after.replace('auth.uid()','null::uuid')],
 ['SHARE upgrade deadlock',r=>r.after.replace(BLOCK,BLOCK.replace('for update;','for share;'))],
 ['missing singleton guard',r=>r.after.replace(BLOCK,BLOCK.replace("errcode='55000'","errcode='00000'"))],
])check('reject coherent nonminimal/unsafe '+name,()=>assert.throws(()=>exact(rows[0],change(rows[0]))));
check('wrong source pin cannot silently generate historical replacement',()=>assert.throws(()=>build(path=>readFileSync(ROOT+path,'utf8')+'\n'),/SOURCE_PIN_MISMATCH/));

function safePacket(sql){
 assert.match(sql,/pg_has_role\(current_user,p.proowner,'USAGE'\)/);
 assert.match(sql,/listing_writer_epoch_privilege_or_rls_not_proven/);
 assert.match(sql,/listing_writer_metadata_unbound/);
 assert.match(sql,/listing_writer_presence_unbound/);
 assert.match(sql,/listing_writer_metadata_changed/);
 assert.match(sql,/RAISE EXCEPTION 'core_listing_writer_adoption_not_admitted' USING ERRCODE='55000'/);
 assert.match(sql,/ROLLBACK;\s*$/);
 for(const r of rows)assert.ok(sql.includes(`IF to_regprocedure('${r.signature}') IS NOT NULL THEN\n  EXECUTE`));
}
const packet=outputs(rows)['supabase/proposals/core-listing-writer-lock-v1/delta.sql'];safePacket(packet);
for(const [name,mutate]of[
 ['wrong owner accepted',s=>s.replaceAll("pg_has_role(current_user,p.proowner,'USAGE')",'true')],
 ['missing metadata binding',s=>s.replaceAll('listing_writer_metadata_unbound','unchecked')],
 ['presence mismatch swallowed',s=>s.replaceAll('listing_writer_presence_unbound','unchecked')],
 ['absent module recreated',s=>s.replace("IF to_regprocedure('"+rows[0].signature+"') IS NOT NULL THEN",'IF true THEN')],
 ['rollback changed to commit',s=>s.replace(/ROLLBACK;\s*$/,'COMMIT;')],
])check('packet negative '+name,()=>assert.throws(()=>safePacket(mutate(packet))));
console.log(JSON.stringify({task:'CORE-DOMAIN-PORTS-01/Listing-writer-lock',new_controls:n,source:'PASS',model:'SCOPED_LOCK_SCHEDULE_ONLY',sql_parser_compile_pg:'NOT_RUN_NOT_PASS',native_currentness:'NOT_READY',activation:null}));
