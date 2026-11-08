/** Actual CE route/provider/C03 and mounted page. Modeled SDK and SQL transport ONLY. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),ts=require('typescript'),root=fileURLToPath(new URL('..',import.meta.url));
assert.equal(require('next/package.json').version,'16.4.1');assert.equal(require('zod/package.json').version,'4.6.6');
let prefix=readFileSync(new URL('./test-ce-guide-create14.mjs',import.meta.url),'utf8').split('// Fixture setup only')[0];
prefix=prefix.replace("if(p==='src/lib/supabase/server.ts')", "if(p==='src/lib/community/community-announcement-runtime-v1.ts')return {get CE010_ANNOUNCEMENT_RUNTIME_V1(){return nativeRuntime;}};if(p==='src/lib/supabase/server.ts')");
prefix+='\nlet nativeRuntime={resolve:null};export const runtime=v=>{nativeRuntime=v;};export const SDK=v=>{legacyBackend=v;};export const context=v=>{contextFixture=v;};export const transport=v=>{transport=v;};';
// Avoid a colliding exported setter; the production provider remains NULL.
prefix=prefix.replace('export const transport=v=>{transport=v;};','export const setTransport=v=>{transport=v;};');
prefix+='\nexport {load,React,act,createRoot,JSDOM,NextRequest};';
prefix=prefix.replace('const require=createRequire(', 'const toolRequire=createRequire(').replaceAll('require(','toolRequire(');
const toolUrl=new URL('./test-ce-guide-create14.mjs',import.meta.url).href;
const js=ts.transpileModule(prefix,{compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true},transformers:{before:[ctx=>{const visit=n=>ts.isPropertyAccessExpression(n)&&n.name.text==='url'&&n.expression.kind===ts.SyntaxKind.MetaProperty?ts.factory.createStringLiteral(toolUrl):ts.visitEachChild(n,visit,ctx);return n=>ts.visitNode(n,visit);}]}}).outputText;
const realm={exports:{}};new Function('require','module','exports',js)(require,realm,realm.exports);
const {load,React,act,createRoot,JSDOM,NextRequest,runtime,SDK,context,setTransport}=realm.exports;
const core=load('src/lib/core/postgres-transaction-host-v1.ts'),domain=load('src/lib/community/community-announcement-provider-v1.ts'),http=load('src/lib/community/community-announcement-http-v1.ts');
const session=load('src/lib/community/community-command-session.ts'),route=load('src/app/api/customer/v1/community/base/route.ts');
// Reuse ONLY the already accepted generic C03 transport setup; no old cases.
let fixtureSource=execFileSync('git',['show','ae8107ad170139b650e884863f83ccb0db63edf2:scripts/test-core-ce012-writer-joint-review-09.mjs'],{cwd:root,encoding:'utf8'});
fixtureSource=fixtureSource.slice(fixtureSource.indexOf('const id=n=>'),fixtureSource.indexOf('async function saved()'));
fixtureSource=fixtureSource.replace("'module.experience_guides'","'module.community_basic'")
 .replace('documentVersion:3','documentVersion:3,announcements:new Map(),canPublish:true,canRead:true,memberAudience:true,audienceValid:true')
 .replace('version:f.version,ledgers:', 'announcements:f.announcements,version:f.version,ledgers:')
 .replace("if(q==='rollback'){", "if(q==='rollback'){")
 .replace("return result([]);}\n  if(q==='commit')", "return {...result([]),command:'ROLLBACK'};}\n  if(q==='commit')")
 .replace("if(f.faultSql===text)throw f.driver;",`if(f.faultSql===text)throw f.driver;
  if(text===core.CORE_SERVER_REPLAY_EXPIRY_SQL_V1)return result([{unexpired:f.expiry>f.now}]);
  if(text===http.CE010_NATIVE_AUTH_SQL)return result([{tenant_id:ids.tenant,membership_id:ids.member,actor_bound:!f.wrongIdentity&&v[2]===ids.actor&&v[3]===id(99)&&v[4]==='4070908800',can_read:f.canRead&&!f.expired&&v[0]===ids.context&&v[1]===ids.workspace,can_publish:f.canPublish&&!f.expired&&v[0]===ids.context&&v[1]===ids.workspace,revision:1}]);
  if(text===http.CE010_NATIVE_READ_SQL){if(f.readWait)await f.readWait();return result([{projection:projection(f)}]);}
  if(text===domain.CE010_COMMUNITY_LOCK_SQL)return result(v[0]===ids.tenant&&v[1]===ids.workspace&&v[2]===id(50)?[{id:id(50),version:1,audience:{kind:'workspace'}}]:[]);
  if(text===domain.CE010_ANNOUNCEMENT_LOCK_SQL){if(f.sourceWait)await f.sourceWait();const a=f.announcements.get(v[3]);return result(a&&a.tenant_id===v[0]&&a.workspace_id===v[1]&&a.community_id===v[2]?[{id:a.id,community_id:a.community_id,version:a.version,status:a.status,body:a.body,audience:a.audience}]:[]);}
  if(text===domain.CE010_AUDIENCE_VALID_SQL)return result([{valid:f.audienceValid}]);
  if(text===domain.CE010_ANNOUNCEMENT_INSERT_SQL){if(f.announcements.has(v[0]))throw Object.assign(Error('modeled collision'),{code:'23505'});f.announcements.set(v[0],{id:v[0],tenant_id:v[1],workspace_id:v[2],community_id:v[3],body:v[4],audience:JSON.parse(v[5]),status:'draft',version:1});f.writes.push('announcement');if(f.expireAfterInsert)f.expired=true;return result([{id:v[0]}]);}
  if(text===domain.CE010_ANNOUNCEMENT_UPDATE_SQL){const a=f.announcements.get(v[3]);if(!a||a.tenant_id!==v[0]||a.workspace_id!==v[1]||a.community_id!==v[2]||a.version!==v[5])return result([]);a.status=v[4];a.version++;f.writes.push(v[4]);return result([{id:a.id}]);}
 `)
 .replace("allowed:!f.expired,evaluated_at", "allowed:!f.expired&&f.canPublish,evaluated_at")
 .replace("allowed:!f.expired}]);", "allowed:!f.expired&&f.canPublish,can_read:!f.expired&&f.canRead}]);");
const {fixture,ids,id}=new Function('core','writer','ce','domain','http','projection','coreSql','ceSql','expirySql',fixtureSource+'\nreturn {fixture,ids,id};')(core,{CE012_SAVE_STORED_SQL:'UNUSED_GUIDE_SAVE',CE012_SAVE_LEDGER_SQL:'UNUSED_GUIDE_LEDGER'}, {},domain,http,projection,'CORE_STORED_UNUSED','CE_STORED_UNUSED','EXPIRY_UNUSED');
function projection(f){const communities=[{id:id(50),workspace_id:ids.workspace,name:'Existing community',version:1,audience_kind:'workspace',can_create_announcement:f.canPublish,can_decide_reports:false}];
 const announcements=[...f.announcements.values()].filter(a=>f.canPublish||(a.status==='published'&&f.memberAudience&&(a.audience.kind!=='members'||a.audience.membership_ids.includes(ids.member)))).map(a=>({id:a.id,community_id:a.community_id,title:a.body.slice(0,120),body:a.body,status:a.status,version:a.version,can_publish:f.canPublish&&a.status==='draft',can_cancel:f.canPublish&&a.status==='published',can_report:false}));
 return {workspace_id:ids.workspace,communities,announcements,reports:[],limit:100};}
function setup(){const f=fixture();let auth=true;
 SDK({schema(){throw Error('LEGACY_FALLBACK_FORBIDDEN');},auth:{getUser:async()=>{f.sdkCalls=(f.sdkCalls??0)+1;f.trace.push({q:'SDK_VERIFY',call:f.sdkCalls});await f.sdkWait?.(f.sdkCalls);return {data:{user:{id:f.sdkActor??ids.actor}},error:auth?null:Error('denied')};},getSession:async()=>({data:{session:{user:{id:f.sdkActor??ids.actor},expires_at:f.sdkExpiry??4070908800}},error:null}),getClaims:async()=>({data:{claims:{sub:f.sdkActor??ids.actor,session_id:f.sdkSid??id(99),exp:f.sdkExpiry??4070908800,role:'authenticated',aal:'aal2'}},error:null}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'},error:null})}}});
 runtime({resolve:async(request)=>({contract:'ce010-request-binding.v1',request,actor_id:ids.actor,session_id:id(99),request_pool:f.pool})});
 const posts=[];let lost=false;
 const fetch=async(url,init={})=>{const request=new NextRequest('http://ce.test'+url,{...init,headers:{origin:'http://ce.test',...init.headers}});if(init.method==='POST'){posts.push(init.body);const r=await route.POST(request);if(lost&&JSON.parse(init.body).op==='execute_announcement'){lost=false;throw Error('controlled lost reply');}return r;}return route.GET(request);};
 const command=(type='create_announcement',n=1,expected_version=1)=>({type,command_id:id(100+n),idempotency_key:'ce010.native.test.'+n,context_id:ids.context,workspace_id:ids.workspace,community_id:id(50),announcement_id:id(60),expected_version,reason:'Synthetic authorized action',...(type==='create_announcement'?{body:'Announcement fixture',audience:{kind:'workspace'}}:{})});
 const holder=()=>session.createCommunityCommandSession({contextId:ids.context,workspaceId:ids.workspace,communityId:id(50),owner:()=>f,changed(){},denied(){},fetch,announcementProtocol:()=>true});
 const post=v=>fetch('/api/customer/v1/community/base',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(v)});
 return {f,fetch,post,posts,command,holder,deny(){auth=false;},lose(){lost=true;}};
}
const only=process.argv.find(a=>a.startsWith('--case='))?.slice(7);let n=0;
async function check(name,fn){if(only&&only!==name)return;await fn();console.log('PASS '+(++n)+' '+name);}
await check('actual route/session/provider/C03 create-publish-cancel and current read',async()=>{const h=setup();
 for(const [op,number,version]of [['create_announcement',1,1],['publish_announcement',2,1],['cancel_announcement',3,2]]){const s=h.holder();assert.equal(await s.send(h.command(op,number,version)),true,JSON.stringify(s.getState()));assert.equal(s.getState().phase,'done');}
 assert.equal(h.f.announcements.get(id(60)).status,'cancelled');assert.equal(h.f.announcements.get(id(60)).version,3);assert.equal(h.f.ledgers.size,3);assert.deepEqual(h.f.writes,['c03','announcement','audit','outbox','c03','published','audit','outbox','c03','cancelled','audit','outbox']);
 const r=await h.fetch(`/api/customer/v1/community/base?context_id=${ids.context}&workspace_id=${ids.workspace}`);assert.equal(r.status,200);assert.equal((await r.json()).announcements[0].id,id(60));assert.equal(r.headers.get('x-cladora-community-read'),'core-announcement-v1');assert.match(r.headers.get('cache-control'),/no-store, private/);
});
await check('lost reply retains exact execute envelope and same key; no automatic duplicate',async()=>{const h=setup(),s=h.holder();h.lose();assert.equal(await s.send(h.command()),false);assert.equal(s.getState().phase,'unknown');const wire=h.posts[1];assert.equal(h.posts.length,2);assert.equal(await s.send(h.command('create_announcement',8)),false);assert.equal(await s.replay(),true);assert.equal(h.posts.length,3);assert.equal(h.posts[2],wire);assert.equal(h.f.commits,1);});
await check('same key tamper, stale version, foreign scope/actor and permission denial',async()=>{const h=setup();assert.equal(await h.holder().send(h.command()),true);const envelope=JSON.parse(h.posts[1]),before=structuredClone(h.f.writes);
 for(const mode of ['hash','actor','scope','key']){const p=structuredClone(envelope);if(mode==='hash')p.command.body='Different';if(mode==='actor')p.core_command.actor_id=id(80);if(mode==='scope')p.command.workspace_id=id(81);if(mode==='key')p.command.idempotency_key='different-key';assert.notEqual((await h.post(p)).status,200);assert.deepEqual(h.f.writes,before);}
 const changed={...envelope.command,body:'Coherently changed same key'},coherent=domain.buildAnnouncementCoreCommandV1(changed,{actor_id:ids.actor,authority_version:1,transaction_id:envelope.core_command.transaction_id});
 assert.equal((await h.post({op:'execute_announcement',command:changed,core_command:coherent})).status,409);assert.deepEqual(h.f.writes,before);
 assert.equal(await h.holder().send(h.command('publish_announcement',4,2)),false);assert.deepEqual(h.f.writes,before);h.f.canPublish=false;assert.equal(await h.holder().send(h.command('publish_announcement',5,1)),false);assert.deepEqual(h.f.writes,before);
 h.f.canPublish=true;h.f.canRead=false;assert.equal(await h.holder().send(h.command('publish_announcement',6,1)),false);assert.deepEqual(h.f.writes,before);
});
await check('audience read is server projection; membership cannot grant publishing',async()=>{const h=setup();assert.equal(await h.holder().send({...h.command(),audience:{kind:'members',membership_ids:[ids.member]}}),true);h.f.canPublish=false;
 const url=`/api/customer/v1/community/base?context_id=${ids.context}&workspace_id=${ids.workspace}`;assert.equal((await(await h.fetch(url)).json()).announcements.length,0);
 h.f.canPublish=true;assert.equal(await h.holder().send(h.command('publish_announcement',2,1)),true);h.f.canPublish=false;assert.equal((await(await h.fetch(url)).json()).announcements.length,1);h.f.memberAudience=false;assert.equal((await(await h.fetch(url)).json()).announcements.length,0);h.f.canRead=false;assert.equal((await h.fetch(url)).status,403);
});
await check('expiry after source wait and post-effect denial roll back C03/domain; original40001',async()=>{const h=setup();h.f.sourceWait=async()=>{h.f.expired=true;};assert.equal(await h.holder().send(h.command()),false);assert.equal(h.f.announcements.size,0);assert.deepEqual(h.f.writes,[]);
 const z=setup();const error=Object.assign(Error('controlled serialization'),{code:'40001'});z.f.faultSql=domain.CE010_ANNOUNCEMENT_INSERT_SQL;z.f.driver=error;assert.equal(await z.holder().send(z.command()),false);assert.equal(z.f.announcements.size,0);assert.deepEqual(z.f.writes,[]);assert.equal(z.f.attempts,4); // one prepare + the host's three attempts
});
await check('selected missing binding never uses legacy; default read preserved; native envelope unavailable',async()=>{const h=setup();runtime({resolve:async()=>null});const url=`/api/customer/v1/community/base?context_id=${ids.context}&workspace_id=${ids.workspace}`;assert.equal((await h.fetch(url)).status,503);assert.equal((await h.post({op:'prepare_announcement',command:h.command()})).status,503);runtime({resolve:null});assert.equal((await h.post({op:'prepare_announcement',command:h.command()})).status,503);assert.equal(h.f.commits,0);
 SDK({auth:{getClaims:async()=>({data:{claims:{sub:ids.actor}},error:null})},schema:()=>({rpc:async(name,args)=>{if(name==='read_ce_community_v1')return {data:projection(h.f),error:null};assert.equal(name,'command_ce_community_v1');return {data:{entity_type:'community_announcement',entity_id:args.p_request.announcement_id,version:1,command:args.p_request.type,replayed:false},error:null};}})});
 const preserved=await h.fetch(url);assert.equal(preserved.status,200);assert.equal(preserved.headers.get('x-cladora-community-read'),null);assert.deepEqual(await preserved.json(),projection(h.f));
 const legacy=session.createCommunityCommandSession({contextId:ids.context,workspaceId:ids.workspace,communityId:id(50),owner:()=>h,fetch:h.fetch,changed(){},denied(){}}),before=h.posts.length;
 assert.equal(await legacy.send(h.command()),true);assert.equal(h.posts.length,before+1);assert.equal(JSON.parse(h.posts.at(-1)).op,undefined);
});
await check('post-effect denial rolls back; malformed preparation/success never clears UNKNOWN',async()=>{
 const h=setup();h.f.expireAfterInsert=true;assert.equal(await h.holder().send(h.command()),false);assert.deepEqual(h.f.writes,[]);assert.equal(h.f.announcements.size,0);assert.equal(h.f.ledgers.size,0);
 for(const stage of ['prepare_announcement','execute_announcement']){const z=setup(),original=z.fetch,s=session.createCommunityCommandSession({contextId:ids.context,workspaceId:ids.workspace,communityId:id(50),owner:()=>z,fetch:async(...args)=>{const r=await original(...args);return JSON.parse(args[1].body).op===stage?Response.json({wrong:'contract'}):r;},changed(){},denied(){},announcementProtocol:()=>true});
  assert.equal(await s.send(z.command()),false);assert.equal(s.getState().phase,'unknown');assert.equal(z.f.commits,stage==='execute_announcement'?1:0);assert.equal(z.posts.length,stage==='execute_announcement'?2:1);
 }
});
await check('late preparation and execution JSON cannot settle a different owner',async()=>{for(const stage of ['prepare_announcement','execute_announcement']){
 const h=setup();let owner={},release,arrived;const at=new Promise(r=>{arrived=r;}),original=h.fetch;
 const s=session.createCommunityCommandSession({contextId:ids.context,workspaceId:ids.workspace,communityId:id(50),owner:()=>owner,changed(){},denied(){},announcementProtocol:()=>true,fetch:async(...args)=>{const r=await original(...args);return JSON.parse(args[1].body).op===stage?{ok:r.ok,status:r.status,json:()=>new Promise(resolve=>{release=async()=>resolve(await r.json());arrived();})}:r;}});
 const pending=s.send(h.command());await at;owner={};await release();assert.equal(await pending,false);assert.equal(s.getState().phase,'unknown');assert.equal(h.f.commits,stage==='execute_announcement'?1:0);assert.equal(h.posts.length,stage==='execute_announcement'?2:1);
}});
await check('wrong DB identity and revoke during read wait disclose no projection or affordance',async()=>{
 for(const mode of ['identity','revoke']){const h=setup();if(mode==='identity')h.f.wrongIdentity=true;else h.f.readWait=async()=>{h.f.expired=true;};
  const r=await h.fetch(`/api/customer/v1/community/base?context_id=${ids.context}&workspace_id=${ids.workspace}`);assert.equal(r.status,403);assert.equal((await r.json()).communities,undefined);assert.equal(h.f.commits,0);assert.deepEqual(h.f.writes,[]);
 }
});
await check('original40001 reaches existing host unchanged; unknown COMMIT recovers same wire',async()=>{
 const h=setup(),g=h.command(),c=domain.buildAnnouncementCoreCommandV1(g,{actor_id:ids.actor,authority_version:1}),original=Object.assign(Error('controlled serialization object'),{code:'40001'});
 h.f.faultSql=domain.CE010_ANNOUNCEMENT_INSERT_SQL;h.f.driver=original;const p=domain.createAnnouncementProviderV1(g),mutate=p.mutate;let identical=0;
 p.mutate=async(...a)=>{try{return await mutate(...a);}catch(e){assert.equal(e,original);identical++;throw e;}};
 assert.equal((await h.f.host.execute(c,p)).status,'denied');assert.equal(identical,3);assert.deepEqual(h.f.writes,[]);
 const z=setup(),s=z.holder();z.f.lostCommit=true;assert.equal(await s.send(z.command()),false);assert.equal(s.getState().phase,'unknown');const wire=z.posts[1];assert.equal(z.f.commits,1);assert.equal(await s.replay(),true);assert.equal(z.posts[2],wire);assert.equal(z.f.commits,1);
});
const Page=load('src/components/customer/CustomerCommunityBasePage.tsx').CustomerCommunityBasePage;
const activeContext=()=>({active:{context_id:ids.context,membership_id:ids.member},dashboard:{contextId:ids.context,workspace_id:ids.workspace},loading:false,pendingContextId:null,registerUnsavedGuard:()=>()=>{}});
async function mount(h,initialLang){const dom=new JSDOM('<div id="root"></div>',{url:'http://ce.test'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});const root=createRoot(document.getElementById('root'));
 context(activeContext());setTransport(h.fetch);const render=async lang=>act(async()=>{root.render(React.createElement(Page,{lang}));await new Promise(r=>setTimeout(r,35));});await render(initialLang);await render(initialLang);
 const submit=async()=>act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,40));});
 const fill=async text=>act(async()=>{const e=document.querySelector('form textarea');assert.ok(e);Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(e,text);e.dispatchEvent(new window.Event('input',{bubbles:true}));});
 return {render,fill,submit,close:async()=>{await act(async()=>root.unmount());dom.window.close();}};
}
for(const lang of ['fa','en','ro'])await check(`mounted ${lang} existing form -> native route -> C03 -> publish/cancel and readback`,async()=>{
 const h=setup(),ui=await mount(h,lang);try{await ui.fill('Valid announcement '+lang);await ui.submit();assert.equal(h.f.announcements.size,1);assert.equal(h.posts.length,2);assert.equal(document.querySelector('form textarea').value,'');
  for(const label of lang==='fa'?['انتشار','لغو']:lang==='ro'?['Publică','Anulează']:['Publish','Cancel']){const button=[...document.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(button,label);await act(async()=>{button.click();await new Promise(r=>setTimeout(r,40));});}
  const a=[...h.f.announcements.values()][0];assert.equal(a.status,'cancelled');assert.equal(a.version,3);assert.equal(h.f.ledgers.size,3);assert.equal(h.posts.length,6);assert.equal(document.querySelector('section').dir,lang==='fa'?'rtl':'ltr');
 }finally{await ui.close();}
});
await check('mounted native UNKNOWN retains original draft across locale/Context and current GET denial',async()=>{
 const h=setup(),ui=await mount(h,'en');try{h.lose();await ui.fill('Retain original body');await ui.submit();const wire=h.posts[1];assert.ok(document.querySelector('[data-community-replay]'));assert.equal(document.querySelector('form textarea').value,'Retain original body');
  await ui.render('fa');assert.equal(h.posts.length,2);assert.equal(document.querySelector('form textarea').value,'Retain original body');
  context({...activeContext(),active:{context_id:id(85),membership_id:id(86)},dashboard:{contextId:id(85),workspace_id:ids.workspace}});await ui.render('fa');assert.equal(document.querySelector('form'),null);
  context(activeContext());await ui.render('ro');await ui.render('ro');assert.ok(document.querySelector('[data-community-replay]'));assert.equal(document.querySelector('form textarea').value,'Retain original body');
  h.f.canRead=false;await act(async()=>{document.querySelector('[data-community-refresh]').click();await new Promise(r=>setTimeout(r,35));});assert.equal(document.querySelector('form'),null);assert.equal(h.posts.length,2);
  h.f.canRead=true;await act(async()=>{document.querySelector('button').click();await new Promise(r=>setTimeout(r,35));});assert.ok(document.querySelector('[data-community-replay]'));
  await act(async()=>{document.querySelector('[data-community-replay]').click();await new Promise(r=>setTimeout(r,40));});assert.equal(h.posts[2],wire);assert.equal(h.posts.length,3);assert.equal(h.f.commits,1);assert.equal(document.querySelector('form textarea').value,'');
 }finally{await ui.close();}
});
await check('QFW-CE010-01 revoke during final SDK wait withholds the former read projection',async()=>{
 const h=setup();h.f.sdkWait=async call=>{if(call===2)h.f.canRead=false;};
 const r=await h.fetch(`/api/customer/v1/community/base?context_id=${ids.context}&workspace_id=${ids.workspace}`);
 assert.equal(r.status,403,'read revoked during final SDK verification must not disclose the earlier projection');assert.equal((await r.json()).communities,undefined);assert.equal(h.f.sdkCalls,2);assert.equal(h.f.commits,0);assert.deepEqual(h.f.writes,[]);
});
await check('QFW matching SDK precedes final canonical guard and rollback; bounded no-store read',async()=>{
 const h=setup(),r=await h.fetch(`/api/customer/v1/community/base?context_id=${ids.context}&workspace_id=${ids.workspace}`);assert.equal(r.status,200);assert.equal((await r.json()).communities[0].name,'Existing community');
 const trace=h.f.trace,lastSdk=trace.findLastIndex(x=>x.q==='SDK_VERIFY'),lastGuard=trace.findLastIndex(x=>x.text===http.CE010_NATIVE_AUTH_SQL),rollback=trace.findLastIndex(x=>x.q==='rollback');
 assert.equal(h.f.sdkCalls,2);assert.ok(lastSdk<lastGuard&&lastGuard<rollback);assert.equal(trace.slice(lastGuard+1).some(x=>x.q==='SDK_VERIFY'),false);
 assert.match(r.headers.get('cache-control'),/no-store, private/);assert.equal(r.headers.get('vary'),'Cookie');assert.equal(r.headers.get('x-cladora-community-read'),'core-announcement-v1');assert.deepEqual(h.f.writes,[]);
});
await check('QFW actor SID expiry and failed final SDK verification withhold without fallback',async()=>{
 for(const mode of ['actor','sid','expiry','error']){const h=setup();h.f.sdkWait=async call=>{if(call!==2)return;if(mode==='actor')h.f.sdkActor=id(87);if(mode==='sid')h.f.sdkSid=id(88);if(mode==='expiry')h.f.sdkExpiry=1;if(mode==='error')throw Error('private SDK failure must not be disclosed');};
  const r=await h.fetch(`/api/customer/v1/community/base?context_id=${ids.context}&workspace_id=${ids.workspace}`);assert.equal(r.status,mode==='error'?503:401);const b=await r.json();assert.equal(b.communities,undefined);assert.doesNotMatch(JSON.stringify(b),/private SDK|Existing community/);assert.equal(h.f.sdkCalls,2);assert.equal(h.f.commits,0);assert.deepEqual(h.f.writes,[]);
 }
});
await check('QFW revoke and restored GET cannot settle earlier UNKNOWN or replace its exact wire',async()=>{
 const h=setup(),s=h.holder();h.lose();assert.equal(await s.send(h.command()),false);const original=s.getState().pending,posts=h.posts.length,writes=structuredClone(h.f.writes);assert.equal(s.getState().phase,'unknown');
 h.f.sdkCalls=0;h.f.sdkWait=async call=>{if(call===2)h.f.canRead=false;};const url=`/api/customer/v1/community/base?context_id=${ids.context}&workspace_id=${ids.workspace}`;
 assert.equal((await h.fetch(url)).status,403);assert.equal(s.getState().phase,'unknown');assert.equal(s.getState().pending,original);
 h.f.sdkWait=undefined;h.f.canRead=true;assert.equal((await h.fetch(url)).status,200);assert.equal(s.getState().phase,'unknown');assert.equal(s.getState().pending,original);assert.equal(h.posts.length,posts);assert.deepEqual(h.f.writes,writes);assert.equal(h.f.commits,1);
});
console.log(JSON.stringify({task:'CE010-COMMUNITY-ANNOUNCEMENT-01',groups:n,proof:'ACTUAL_ROUTE_PROVIDER_CORE_WITH_CONTROLLED_TRANSPORT',native:'NOT_RUN_NOT_PASS'}));
