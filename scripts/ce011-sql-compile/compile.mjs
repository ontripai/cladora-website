/** Actual PostgreSQL-WASM body validation in a task-owned memory database.
 * Product guard is untouched: only exact function declarations are submitted.
 * No network, listener, private target, Auth, shared installer or 11-case suite. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../..',import.meta.url));
const args=process.argv.slice(2),engine=args.find(x=>x.startsWith('--engine='))?.slice(9),out=args.find(x=>x.startsWith('--receipt='))?.slice(10);
assert.equal(args.length,2);assert.ok(engine&&out&&path.isAbsolute(engine)&&path.isAbsolute(out));assert.ok(!existsSync(out),'PRESERVE_EXISTING_RECEIPT');
const sha=b=>createHash('sha256').update(b).digest('hex');
const candidatePath='supabase/proposals/ce011-basic-event-command-v2/command.sql',legacyPath='supabase/proposals/ce_011_event_interest_operational_v1.sql';
const source=readFileSync(path.join(root,candidatePath),'utf8'),legacy=readFileSync(path.join(root,legacyPath),'utf8');
assert.equal(sha(source),'8c50327189769c022fd3c9b13f1620d9abb8fc910fe01e670aa2ec12c304d1ce');assert.equal(sha(legacy),'5894363db4fa0fee49737371546e9cd1cbeddb2dcc44723a81cca396004feafc');
assert.ok(source.includes("RAISE EXCEPTION 'ce011_v2_source_only_no_admission'"));
function span(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a)+end.length;assert.ok(a>=0&&b>a);assert.equal(text.indexOf(start,a+1),-1);const declaration=text.slice(a,b),bodyStart=declaration.indexOf('as $$')+5,bodyEnd=declaration.lastIndexOf('$$;');assert.ok(bodyStart>=5&&bodyEnd>bodyStart);return{declaration,body:declaration.slice(bodyStart,bodyEnd),offset:Buffer.byteLength(text.slice(0,a)),bytes:Buffer.byteLength(declaration)};}
const units=[['app_private.ce011_audience_current_v2(uuid,uuid)',span(source,'create function app_private.ce011_audience_current_v2(','\n$$;')],['customer_api.command_ce_event_v2(jsonb)',span(source,'create function customer_api.command_ce_event_v2(','\nend$$;')]];
const tables=['events','event_occurrences','event_audience_roles','event_audience_members','event_interests','event_attendance','event_command_receipts'].map(n=>{const start='create table community.'+n+'(';const a=legacy.indexOf(start),b=legacy.indexOf('\n);',a)+4;assert.ok(a>=0&&b>a);return legacy.slice(a,b);});
const authorizer=span(legacy,'create function app_private.ce_event_authorize_v1(','\nend$$;').declaration;
const fixtures=readFileSync(new URL('./dependency-substitutes.sql',import.meta.url),'utf8');
const packageInfo=JSON.parse(readFileSync(path.join(engine,'package.json'),'utf8'));assert.equal(packageInfo.name,'@electric-sql/pglite');assert.equal(packageInfo.version,'0.3.14');
const enginePins={
 'dist/index.js':'03bce0708dbe57ab154c75089ded04c47d0a9e713fe397dee33cd3912101cab5',
 'dist/pglite.wasm':'8140392c5f70c5aecb40f514db242fce4223cfdd5f37a2b101dbdc30208dc49d',
 'dist/pglite.data':'4703ec26f5710abb62db42acad229478b75c51ef7f3bb037286bb2bac139a930',
 'package.json':'a540c379fd1d820810793681d25fa7ad5dadfcee2b190d14a6553fdb469cfe3c',
};for(const[p,pin]of Object.entries(enginePins))assert.equal(sha(readFileSync(path.join(engine,p))),pin,'ENGINE_PIN_MISMATCH '+p);
const receipt={task:'CE011_SQL_COMPILE',executor:'CLADORA-CE-WORKER-01',source:{path:candidatePath,bytes:Buffer.byteLength(source),sha256:sha(source),guard_untouched:true},legacy_source:{path:legacyPath,sha256:sha(legacy)},harness_sha256:sha(readFileSync(fileURLToPath(import.meta.url))),fixture_sha256:sha(fixtures),engine:{name:packageInfo.name,version:packageInfo.version,pins:enginePins,mode:'POSTGRESQL_WASM_IN_MEMORY_TASK_OWNED'},dependency_class:{CE_tables:'7 exact canonical declarations',CE_authorizer:'exact canonical declaration',Core_Auth_shared_shapes:'EXPLICIT_DENY_ONLY_SUBSTITUTES',RLS_roles_triggers:'NOT_INSTALLED'},units:[],status:'STARTED',native_RLS:'NOT_RUN_NOT_PASS',installation:'NOT_RUN',real_Auth:'NOT_RUN',all_seven_execution_plans:'NOT_RUN_NOT_CLAIMED'};
let db;const {PGlite}=await import(pathToFileURL(path.join(engine,'dist/index.js')).href);
try{
 db=new PGlite();await db.waitReady;
 receipt.engine.postgres=(await db.query("select version() as version,current_setting('server_version_num') as server_version_num")).rows[0];
 await db.exec('set check_function_bodies=on');receipt.check_function_bodies=(await db.query('show check_function_bodies')).rows[0].check_function_bodies;assert.equal(receipt.check_function_bodies,'on');
 await db.exec(fixtures);for(const ddl of tables)await db.exec(ddl);await db.exec(authorizer);
 // Engine control: prove body syntax is actually checked, not a string label.
 try{await db.exec("create function compile_fixture.invalid_body() returns integer language plpgsql as $$begin NOT_VALID_PLPGSQL; end$$;");throw Error('ENGINE_CONTROL_DID_NOT_REJECT');}catch(e){if(e.code!=='42601')throw e;receipt.invalid_body_control={result:'REJECTED',SQLSTATE:e.code};}
 for(const[signature,unit]of units){const row={signature,offset:unit.offset,bytes:unit.bytes,declaration_sha256:sha(unit.declaration),source_body_sha256:sha(unit.body),status:'STARTED'};receipt.units.push(row);
  try{await db.exec(unit.declaration);const meta=(await db.query("select p.prosrc,p.prosecdef,p.provolatile,p.proconfig,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_functiondef(p.oid) as definition from pg_proc p where p.oid=to_regprocedure($1)",[signature])).rows[0];assert.ok(meta);row.compiled_body_sha256=sha(meta.prosrc);assert.equal(row.compiled_body_sha256,row.source_body_sha256);row.definition_sha256=sha(meta.definition);row.identity_arguments=meta.arguments;row.security_definer=meta.prosecdef;row.volatility=meta.provolatile;row.config=meta.proconfig;row.status='PASS_EMBEDDED_BODY_VALIDATION';}
  catch(e){row.status='FAILED_NOT_PASS';row.SQLSTATE=e.code??null;row.error=String(e.message);throw e;}
 }
 // Deny-only guard sanity, NOT a real Auth/RLS/currentness or positive command.
 const allowed=(await db.query("select auth.uid() as actor,app_private.check_workspace_native_permission_v2(null,null,'events.event.publish','community_events') as allowed")).rows[0];assert.equal(allowed.actor,null);assert.equal(allowed.allowed,false);receipt.fixture_guard_control='DENY_ONLY';
 receipt.status='PASS_EMBEDDED_BODY_VALIDATION_ONLY';
}catch(e){receipt.status='FAILED_NOT_PASS';receipt.SQLSTATE=e.code??null;receipt.error=String(e.message);process.exitCode=1;}
finally{if(db)await db.close();assert.equal(sha(readFileSync(path.join(root,candidatePath))),receipt.source.sha256);receipt.guard_unchanged_after=true;mkdirSync(path.dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:receipt.status,receipt:out,units:receipt.units.map(x=>({signature:x.signature,status:x.status,SQLSTATE:x.SQLSTATE})),SQLSTATE:receipt.SQLSTATE,native:'NOT_RUN_NOT_PASS'}));}
