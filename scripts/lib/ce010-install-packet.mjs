/** Offline CE010 packet construction/catalog diagnostics only. No driver, query,
 * process execution, installer, role selection or runtime authority capability. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import ts from 'typescript';
export const CE010_PACKET_BASE='d23346a88253290d8842dfa0780a67c00c250390';
export const sourcePins=Object.freeze({
 'supabase/proposals/ce_010_community_operational_v1.sql':'53d999c351b36b62f253f0f13349bd154da2cac7b7900ff2a2146bc1ab660bf3',
 'src/lib/community/community-announcement-provider-v1.ts':'b34f8cdcd332a9336ba4da11655722d21364dd411879cdaa31cf88ae8bb7dd56',
 'src/lib/community/community-announcement-http-v1.ts':'d3b50b33dd0189a53a584cd494d64ff883b7c089e339c50bbb8d76a9279a5765',
 'src/lib/core/postgres-transaction-host-v1.ts':'9436c082f8ce8a054d8300f55bd49ac4b6120240cf06fa6ca94190b5c6c1858a',
 'src/lib/core/current-authority-postgres-provider-v1.ts':'0703bd3a6268a9f86c321e714eb1a28ee791c4bf3c7747865c7576106247334a',
});
export const sha256=x=>createHash('sha256').update(x).digest('hex');
const stable=x=>Array.isArray(x)?`[${x.map(stable).join(',')}]`:x&&typeof x==='object'?`{${Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')}}`:JSON.stringify(x);
const tables=['community.communities','community.announcements','community.content_reports'];
const routines=[['app_private.ce_community_authorize_v1','uuid,uuid,text'],['app_private.ce_community_audience_valid_v1','jsonb,uuid,uuid'],['app_private.ce_community_audience_allows_v1','uuid,uuid,jsonb'],['customer_api.read_ce_community_v1','uuid,uuid']];
export const columnRights=Object.freeze({
 'community.communities':{executor:{SELECT:['id','tenant_id','workspace_id','version','audience'],UPDATE:['version']},owner:{SELECT:['id','tenant_id','workspace_id','name','version','audience','created_at']}},
 'community.announcements':{executor:{SELECT:['id','tenant_id','workspace_id','community_id','version','audience','status','body'],INSERT:['id','tenant_id','workspace_id','community_id','body','audience','status','version','created_by'],UPDATE:['status','version','updated_at']},owner:{SELECT:['id','tenant_id','workspace_id','community_id','body','audience','status','version','created_at']}},
 'community.content_reports':{executor:{},owner:{SELECT:['id','tenant_id','workspace_id','community_id','target_id','reporter_membership_id','report_reason','status','version','created_at']}},
});
const context="nullif(current_setting('request.cladora.context_id',true),'')::uuid";
const readGate=`__CE_WORKSPACE__=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid and exists(select 1 from app_private.resolve_workspace_native_context_v2_at_v1(${context},__CE_WORKSPACE__,clock_timestamp()) c where c.tenant_id=__CE_TENANT__) and app_private.check_workspace_native_permission_v2_at_v1(${context},__CE_WORKSPACE__,'community.community.read','community_basic',clock_timestamp())`;
const writeGate=readGate+` and app_private.check_workspace_native_permission_v2_at_v1(${context},__CE_WORKSPACE__,'community.announcement.publish','community_basic',clock_timestamp())`;
export const policyPlan=Object.freeze([
 {table:tables[0],name:'ce010_owner_read',role:'owner',command:'SELECT',using:readGate,check:null},
 {table:tables[0],name:'ce010_executor_read',role:'executor',command:'SELECT',using:writeGate,check:null},
 {table:tables[0],name:'ce010_executor_lock_only',role:'executor',command:'UPDATE',using:writeGate,check:'false'},
 {table:tables[1],name:'ce010_owner_read',role:'owner',command:'SELECT',using:readGate,check:null},
 {table:tables[1],name:'ce010_executor_read',role:'executor',command:'SELECT',using:writeGate,check:null},
 {table:tables[1],name:'ce010_executor_insert',role:'executor',command:'INSERT',using:null,check:writeGate},
 {table:tables[1],name:'ce010_executor_update',role:'executor',command:'UPDATE',using:writeGate,check:writeGate},
 {table:tables[2],name:'ce010_owner_read',role:'owner',command:'SELECT',using:readGate,check:null},
].map(p=>({...p,using:p.using?.replaceAll('__CE_WORKSPACE__',p.table+'.workspace_id').replaceAll('__CE_TENANT__',p.table+'.tenant_id')??null,check:p.check?.replaceAll('__CE_WORKSPACE__',p.table+'.workspace_id').replaceAll('__CE_TENANT__',p.table+'.tenant_id')??null})));
const reviewGuard="DO $review$ BEGIN RAISE EXCEPTION 'ce010_review_only_no_target_admission' USING ERRCODE='55000'; END $review$;";
const guarded=(body,readOnly=false)=>`-- REVIEW-ONLY; Platform must integrate with its exact accepted target/role lane.\nBEGIN${readOnly?' ISOLATION LEVEL REPEATABLE READ READ ONLY':''};\nSET LOCAL search_path=pg_catalog;\nSET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s';\n${reviewGuard}\n${body}\n${readOnly?'ROLLBACK':'COMMIT'};\n`;
const dollar=x=>{assert.ok(!x.includes('$ce_policy$'));return '$ce_policy$'+x+'$ce_policy$';};
function declaration(source,start,end){const from=source.indexOf(start);assert.ok(from>=0);assert.equal(source.indexOf(start,from+1),-1);const to=source.indexOf(end,from)+end.length;assert.ok(to>from);return {offset:Buffer.byteLength(source.slice(0,from)),bytes:Buffer.byteLength(source.slice(from,to)),text:source.slice(from,to)};}
function queryCensus(source,path){const tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true),rows=[];
 function walk(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&(ts.isStringLiteral(n.initializer)||ts.isNoSubstitutionTemplateLiteral(n.initializer))&&/SQL/.test(n.name.text))rows.push({symbol:n.name.text,sql:n.initializer.text});
  if(ts.isCallExpression(n)&&n.arguments[0]&&(ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='query'||ts.isIdentifier(n.expression)&&n.expression.text==='wire')){const arg=n.arguments[0];if(ts.isStringLiteral(arg)||ts.isNoSubstitutionTemplateLiteral(arg))rows.push({symbol:'inline:'+tree.getLineAndCharacterOfPosition(n.getStart()).line,sql:arg.text});else if(ts.isTemplateExpression(arg))rows.push({symbol:'dynamic_core_template:'+tree.getLineAndCharacterOfPosition(n.getStart()).line,source:arg.getText(tree),requires:'Core closed-admission expansion'});}
  ts.forEachChild(n,walk);
 }walk(tree);return rows.map(x=>({...x,path,sha256:sha256(x.sql??x.source)}));}
export function buildCe010Packet(read){
 const inputs={};for(const[p,pin]of Object.entries(sourcePins)){const b=read(p);assert.equal(sha256(b),pin,'READONLY_DEPENDENCY_MISMATCH '+p);inputs[p]=b.toString('utf8');}
 const canonical=inputs[Object.keys(sourcePins)[0]],blocks=[];
 for(const t of tables)blocks.push({kind:'table',name:t,...declaration(canonical,`create table ${t} (`,'\n);')});
 for(const line of canonical.split('\n').filter(x=>/^create (unique )?index ce_(communities|announcements|reports|content_report)_/.test(x)))blocks.push({kind:'index',name:line.match(/index (\S+)/)[1],...declaration(canonical,line,';')});
 for(const[name,args]of routines){const block=declaration(canonical,`create function ${name}(`,'end $$;');blocks.push({kind:'function',name,signature:name+'('+args+')',body_sha256:sha256(block.text.match(/as \$\$(.*)\$\$;/s)[1]),security_definer:block.text.includes('security definer'),volatility:block.text.includes('stable')?'s':'v',...block});}
 const ownedDDL=blocks.map(x=>x.text).join('\n\n');assert.ok(!ownedDDL.includes('command_ce_community_v1(')&&!ownedDDL.includes('create table community.community_command_receipts'));
 const precondition=`DO $pre$ DECLARE owner_name text:=current_setting('cladora.ce010.owner',true); executor_name text:=current_setting('cladora.ce010.executor',true); BEGIN
 IF owner_name IS NULL OR executor_name IS NULL OR owner_name=executor_name OR current_user<>owner_name
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN(owner_name,executor_name) AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolcanlogin))
 OR (SELECT count(*) FROM pg_roles WHERE rolname IN(owner_name,executor_name))<>2
 OR EXISTS(SELECT 1 FROM unnest(ARRAY[${tables.map(t=>"'"+t+"'").join(',')}]) t WHERE to_regclass(t) IS NOT NULL)
 OR EXISTS(SELECT 1 FROM unnest(ARRAY[${routines.map(([f,a])=>"'"+f+'('+a+")'").join(',')}]) f WHERE to_regprocedure(f) IS NOT NULL)
 THEN RAISE EXCEPTION 'ce010_fresh_prestate_or_role_mismatch' USING ERRCODE='55000';END IF;
 -- Target, bounded role graph, temporary schema-CREATE lane and shared-helper
 -- ACL/owner seals are supplied by the existing admitted Core/Platform wrapper.
END $pre$;`;
 let rights='';for(const t of tables)rights+=`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;\nALTER TABLE ${t} FORCE ROW LEVEL SECURITY;\nREVOKE ALL ON ${t} FROM PUBLIC,anon,authenticated,service_role;\n`;
 rights+='DO $rights$ DECLARE e text:=current_setting(\'cladora.ce010.executor\',true); o text:=current_setting(\'cladora.ce010.owner\',true); BEGIN\n';
 for(const[t,groups]of Object.entries(columnRights))for(const role of ['executor'])for(const[priv,cols]of Object.entries(groups[role]))rights+=`EXECUTE format('GRANT ${priv} (${cols.join(',')}) ON ${t} TO %I',e);\n`;
 for(const p of policyPlan){const stmt=`CREATE POLICY ${p.name} ON ${p.table} FOR ${p.command} TO %I${p.using?' USING ('+p.using+')':''}${p.check?' WITH CHECK ('+p.check+')':''}`;rights+=`EXECUTE format(${dollar(stmt)},${p.role==='owner'?'o':'e'});\n`;}
 for(const[f,a]of routines){rights+=`REVOKE ALL ON FUNCTION ${f}(${a}) FROM PUBLIC,anon,authenticated,service_role;\n`;if(/audience_valid|read_ce_community/.test(f))rights+=`EXECUTE format('GRANT EXECUTE ON FUNCTION ${f}(${a}) TO %I',e);\n`;}
 rights+='END $rights$;';
 const relationValues=tables.map(x=>"'"+x+"'").join(','),functionValues=routines.map(([n,a])=>"'"+n+'('+a+")'").join(',');
 const catalog=`SELECT jsonb_build_object(
 'database',current_database(),'database_oid',(SELECT oid FROM pg_database WHERE datname=current_database()),'version',current_setting('server_version_num'),
 'relations',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',n.nspname||'.'||c.relname,'oid',c.oid,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'acl',a.attacl,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid),'validated',k.convalidated) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid) FROM pg_index i WHERE i.indrelid=c.oid),
 'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'roles',p.polroles,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid=c.oid)) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid IN(SELECT to_regclass(v) FROM unnest(ARRAY[${relationValues}]) v)),
 'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),'security_definer',p.prosecdef,'volatility',p.provolatile,'language',(SELECT lanname FROM pg_language WHERE oid=p.prolang),'result',pg_get_function_result(p.oid),'strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,'config',p.proconfig,'acl',p.proacl) ORDER BY p.oid),'[]') FROM pg_proc p WHERE p.oid IN(SELECT to_regprocedure(v) FROM unnest(ARRAY[${functionValues}]) v)),
 'roles',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',rolname,'oid',oid,'super',rolsuper,'bypassrls',rolbypassrls,'createrole',rolcreaterole,'createdb',rolcreatedb,'replication',rolreplication,'login',rolcanlogin,'inherit',rolinherit) ORDER BY rolname),'[]') FROM pg_roles WHERE rolname IN(current_setting('cladora.ce010.owner',true),current_setting('cladora.ce010.executor',true),current_setting('cladora.ce010.runtime',true))),
 'role_edges',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor),'[]') FROM pg_auth_members m WHERE m.roleid IN(SELECT oid FROM pg_roles WHERE rolname IN(current_setting('cladora.ce010.owner',true),current_setting('cladora.ce010.executor',true),current_setting('cladora.ce010.runtime',true))) OR m.member IN(SELECT oid FROM pg_roles WHERE rolname IN(current_setting('cladora.ce010.owner',true),current_setting('cladora.ce010.executor',true),current_setting('cladora.ce010.runtime',true)))),
 'default_acl',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.oid),'[]') FROM pg_default_acl d WHERE d.defaclnamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('community','app_private','customer_api')) OR d.defaclnamespace=0)) AS ce010_catalog;
-- No app/auth/session rows or secret catalog fields are selected.
-- Direct-edge census is NOT transitive role-safety proof; Core owns that seal.`;
 const aclRows=Object.entries(columnRights).flatMap(([table,g])=>Object.entries(g.executor).flatMap(([priv,cols])=>cols.map(col=>`('${table}','${col}','${priv}')`))).join(',');
 const postcheck=`DO $post$ DECLARE e oid:=to_regrole(current_setting('cladora.ce010.executor',true)); o oid:=to_regrole(current_setting('cladora.ce010.owner',true)); BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c WHERE c.oid IN(SELECT to_regclass(v) FROM unnest(ARRAY[${relationValues}]) v) AND (c.relowner<>o OR NOT c.relrowsecurity OR NOT c.relforcerowsecurity))
 OR EXISTS(SELECT 1 FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid IN(SELECT to_regclass(v) FROM unnest(ARRAY[${relationValues}]) v) AND a.grantee<>o)
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute col ON col.attrelid=c.oid,LATERAL aclexplode(col.attacl) a
  WHERE c.oid IN(SELECT to_regclass(v) FROM unnest(ARRAY[${relationValues}]) v) AND a.grantee<>o AND (a.grantee<>e OR a.is_grantable OR NOT EXISTS(SELECT 1 FROM (VALUES ${aclRows}) allowed(tbl,colname,priv) WHERE allowed.tbl=n.nspname||'.'||c.relname AND allowed.colname=col.attname AND allowed.priv=a.privilege_type)))
 OR (SELECT count(*) FROM pg_policy WHERE polrelid IN(SELECT to_regclass(v) FROM unnest(ARRAY[${relationValues}]) v))<>8
 OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid IN(SELECT to_regprocedure(v) FROM unnest(ARRAY[${functionValues}]) v)
  AND (p.proowner<>o OR (a.grantee<>o AND (a.grantee<>e OR a.is_grantable OR a.privilege_type<>'EXECUTE' OR p.proname NOT IN('ce_community_audience_valid_v1','read_ce_community_v1')))))
 THEN RAISE EXCEPTION 'ce010_postimage_acl_rls_mismatch' USING ERRCODE='55000';END IF;
 -- Full function-body/ABI/column/default/constraint/index/policy expression and
 -- protected role/default-ACL postimages are captured for independent verify.
END $post$;`;
 const files={'00-preflight.sql':guarded(catalog,true),'10-domain-candidate.sql':guarded(precondition+'\n'+ownedDDL+'\n'+rights+'\n'+postcheck),'20-verify.sql':guarded(catalog,true),'30-recovery.sql':guarded(catalog+'\n-- UNKNOWN: compare actual catalog with sealed pre/postimage; do not replay, DROP or rewrite rows.',true)};
 const plan={contract:'ce010-install-source-packet.v1',base:CE010_PACKET_BASE,activation:null,roles:{owner:null,executor:null,runtime:null},target:null,
  Core_admission:{factory:null,role_graph:null,schema_CREATE_lane:null,helper_ownership_acl:null,closed_SQL:null,mapping:null,reference_postimage:null},
  sources:Object.entries(sourcePins).map(([path,sha256])=>({path,sha256})),declarations:blocks.map(({text,...b})=>({...b,sha256:sha256(text)})),
  queries:Object.entries(inputs).filter(([p])=>p.endsWith('.ts')).flatMap(([p,s])=>queryCensus(s,p)),columns:columnRights,policies:policyPlan,
  order:['Core admitted target/role/temporary CREATE/helper/source/producer preflight','fresh-only CE tables/functions/rights/RLS in ONE transaction','Core temporary-CREATE lane closure; no owner/role graph change in CE packet','full bounded catalog postimage and protected preimage comparison','Platform native tests and independent QA'],
  omitted:['legacy command_ce_community_v1 writer','community.community_command_receipts','receipt trigger','permission/module/entitlement seeds','Core/shared-object grants','role creation/membership/ownership transfer','schema creation','existing Foundation/runner edits'],
  files:Object.entries(files).map(([path,s])=>({path,bytes:Buffer.byteLength(s),sha256:sha256(s)})),runtime:'NOT_READY_CORE_PRODUCER_MISSING',native:'NOT_RUN_NOT_PASS'};
 return {files,plan};
}
/** Offline metadata consistency diagnostic, never a permit or native proof.
 * Full reference postimage and Core graph/helper/source seals are deliberately
 * unresolved until delivered. There is no "approved:true"/role-name shortcut. */
export function compareCe010Catalog(pre,post,expected){
 if(!expected?.reference||!expected?.core_seal)return {status:'BLOCKED_CORE_SEALS'};
 if(pre.target!==post.target||post.target!==expected.target)return {status:'TARGET_MISMATCH'};
 if(stable(pre.roles)!==stable(post.roles)||stable(pre.role_edges)!==stable(post.role_edges)||stable(pre.default_acl)!==stable(post.default_acl))return {status:'PROTECTED_CENSUS_CHANGED'};
 if(stable(post.objects)!==stable(expected.reference))return {status:'POSTIMAGE_MISMATCH'};
 return {status:'CATALOG_CONSISTENT_ONLY',native:false,authority:false};
}
export function classifyCe010Recovery(pre,actual,expected){
 const compared=compareCe010Catalog(pre,actual,expected);if(compared.status==='CATALOG_CONSISTENT_ONLY')return {status:'POSTIMAGE_MATCH_NO_REPLAY',native:false};
 if(expected?.reference&&expected?.core_seal&&pre.target===expected.target&&pre.target===actual.target&&pre.objects?.length===0&&stable(pre)===stable(actual))return {status:'PREIMAGE_MATCH_REVIEWABLE_RETRY',automatic_retry:false};
 return {status:'UNKNOWN_NO_ACK_NO_MUTATION',reason:compared.status};
}
export function verifyCe010Packet(packet,read){
 const reference=buildCe010Packet(read);
 // Byte equality to independently rederived pinned source precedes mutable
 // manifest hashes. Re-sealing a modified candidate cannot authorize extra SQL.
 assert.equal(stable(packet.files),stable(reference.files),'EXECUTABLE_PACKET_MISMATCH');
 assert.equal(stable(packet.plan),stable(reference.plan),'PACKET_MANIFEST_MISMATCH');
 return {status:'SOURCE_BYTES_MATCH_ONLY',native:false,authority:false};
}
