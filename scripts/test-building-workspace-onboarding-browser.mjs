import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdtemp,writeFile,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium,expect}=process.env.BUILDING_SETUP_PLAYWRIGHT_PATH?require(process.env.BUILDING_SETUP_PLAYWRIGHT_PATH):require('@playwright/test');
const lifecycleOnly=process.env.BUILDING_SETUP_LIFECYCLE_ONLY==='1';
const reviewOnly=lifecycleOnly||process.env.BUILDING_SETUP_REVIEW_ONLY==='1';
const reviewWidths=(process.env.BUILDING_SETUP_REVIEW_WIDTHS??'320,390,1280').split(',').map(Number);
assert.ok(reviewWidths.length&&reviewWidths.every(width=>[320,390,1280].includes(width)),'supported review viewports required');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const reviewer=join(root,'src/components/customer/PilotReviewerPanel.tsx'),caseConsumer=join(root,'src/components/cases/CasePortal.tsx');
const component=join(root,'src/components/customer/CustomerBuildingSetupWizard.tsx'),provider=join(root,'src/components/customer/CustomerContextProvider.tsx');
const workspace='90000000-0000-0000-0000-000000000001',otherWorkspace='90000000-0000-0000-0000-000000000002';
const a='80000000-0000-0000-0000-000000000004',b='80000000-0000-0000-0000-000000000006',run='80000000-0000-0000-0000-000000000005';
const copy={en:['Controlled building setup','Create draft','Run rehearsal','Submit for approval','Provision structure','Refresh saved status','Check status and retry saved attempt'],ro:['Configurare controlată a clădirii','Creează proiect','Rulează simularea','Trimite spre aprobare','Creează structura','Actualizează starea salvată','Verifică starea și reîncearcă operațiunea salvată'],fa:['راه‌اندازی کنترل‌شده ساختمان','ایجاد پیش‌نویس','اجرای آزمایشی','ارسال برای تأیید','ایجاد ساختار','دریافت وضعیت ثبت‌شده','بررسی وضعیت و تکرار همان تلاش']};
let browser,server,compiler,temp,state,origin;const contexts=new Set(),errors=[],requests=[];
const receipt={suite:'PROCEDURE-BUILDING-WORKSPACE-SLICE-01',boundary:'REAL_CHROMIUM_ACTUAL_REACT_CONTEXT_AND_CSS_SYNTHETIC_LOOPBACK_API',real_auth_rpc_db:'NOT_RUN_NOT_PASS',physical_device:'NOT_RUN_NOT_PASS',cases:[],external_requests:0};
const send=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
try{
 temp=await mkdtemp(join(tmpdir(),'building-setup-browser-'));const entry=join(temp,'entry.tsx'),loader=join(temp,'loader.cjs');
 await writeFile(loader,`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;`);
 await writeFile(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import {CustomerContextProvider,useCustomerContext} from ${JSON.stringify(provider)};import {CustomerBuildingSetupWizard} from ${JSON.stringify(component)};import {PilotReviewerPanel} from ${JSON.stringify(reviewer)};import {CaseConversation} from ${JSON.stringify(caseConsumer)};
 function ReviewerFixture(){const [lang,setLang]=React.useState(document.documentElement.lang);return <><nav aria-label="Synthetic locale controls">{['en','ro','fa'].map(locale=><button key={locale} data-review-lang={locale} onClick={()=>setLang(locale)}>{locale}</button>)}</nav><PilotReviewerPanel lang={lang}/></>;}function Fixture(){const c=useCustomerContext();return <><nav aria-label="Synthetic Context controls"><button onClick={()=>c.select('${a}')} data-context="A">A</button><button onClick={()=>c.select('${b}')} data-context="B">B</button><button onClick={c.cancelContextChange} data-keep>Keep</button><button onClick={c.confirmContextChange} data-discard>Discard</button><output data-active>{c.active?.context_id}</output><output data-pending>{c.pendingContextId}</output></nav><CustomerBuildingSetupWizard lang={document.documentElement.lang}/></>;}const view=new URLSearchParams(location.search).get('view');const lang=document.documentElement.lang;createRoot(document.getElementById('root')).render(view==='reviewer'?<ReviewerFixture/>:view==='case'?<CaseConversation lang={lang} detail={{id:'${a}',status:'open',workspace_id:'${workspace}',contract_id:null,staff_view:true,messages:[],unread_count:0}} documents={[]} userId='${a}' manager={true} approver={false} reviewer={false} staffOptions={[]}/>:<CustomerContextProvider><Fixture/></CustomerContextProvider>);`);
 const webpack=require('next/dist/compiled/webpack/webpack').webpack;
 compiler=webpack({mode:'development',devtool:false,target:'web',entry,output:{path:temp,filename:'app.js'},plugins:[new webpack.ProvidePlugin({process:require.resolve('next/dist/build/polyfills/process')})],resolve:{extensions:['.tsx','.ts','.js','.json'],modules:[join(root,'node_modules')],alias:{'@':join(root,'src')}},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:[{loader}]}]}});
 await new Promise((yes,no)=>compiler.run((error,stats)=>error||stats.hasErrors()?no(Error(stats?.toString({all:false,errors:true})??String(error))):yes()));
 await new Promise((yes,no)=>compiler.close(error=>error?no(error):yes()));compiler=null;
 const css=await require('postcss')([require('tailwindcss')({...require(join(root,'tailwind.config.js')),content:[component,provider,reviewer,caseConsumer,entry]})]).process(await readFile(join(root,'src/styles/globals.css'),'utf8'),{from:join(root,'src/styles/globals.css')});
 const js=await readFile(join(temp,'app.js'));
 receipt.reviewer_sha256=createHash('sha256').update(await readFile(reviewer)).digest('hex');
 receipt.source_sha256=createHash('sha256').update(await readFile(component)).digest('hex');
 receipt.css_sha256=createHash('sha256').update(css.css).digest('hex');
 server=createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,origin??'http://127.0.0.1');
   if(u.pathname==='/app.js'){res.setHeader('content-type','application/javascript');res.end(js);return;}
   if(u.pathname==='/style.css'){res.setHeader('content-type','text/css');res.end(css.css);return;}
   if(['/en','/ro','/fa'].includes(u.pathname)){const lang=u.pathname.slice(1);res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="${lang}" dir="${lang==='fa'?'rtl':'ltr'}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><main id="root"></main><script src="/app.js"></script></body></html>`);return;}
   if(u.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
   if(!u.pathname.startsWith('/api/')){res.writeHead(404);res.end();return;}
   requests.push({path:u.pathname,method:req.method,context:u.searchParams.get('context_id')});
   if(u.pathname.endsWith('/contexts')){send(res,200,{contexts:[a,b].map(id=>({context_id:id,membership_id:id,tenant_name:'Synthetic',role_code:'association_admin',role_name:'Administrator',scope_type:'tenant',context_label:id}))});return;}
   if(u.pathname.endsWith('/dashboard')){send(res,200,{contextId:u.searchParams.get('context_id'),workspace_id:u.searchParams.get('context_id')===a?workspace:otherWorkspace});return;}
   if(u.pathname.endsWith('/pilot-reviewer')){if(state.reviewerDeny){send(res,state.reviewerDeny,{error:{code:'FORBIDDEN'}});return;}send(res,200,{reviewer:{status:'active',context_id:a,workspace_id:workspace,runs:state.stage==='submitted'?[{id:run,workspace_id:workspace,status:'submitted',building:'Synthetic',revision:state.revision,payload_hash:'a'.repeat(64),submitted_revision:state.revision,submitted_payload_hash:'a'.repeat(64)}]:[]}});return;}
   if(u.pathname==='/api/platform/v1/cases/workspaces'){
    if(req.method==='GET'){send(res,200,u.searchParams.has('idempotency_key')?{attempt:state.caseReceipt??null}:{options:[{profile:'residential',model:'association_managed',profile_label:{en:'Synthetic'},model_label:{en:'Association'}}],prepared:[]});return;}
    let raw='';for await(const chunk of req)raw+=chunk;state.posts.push({path:u.pathname,body:raw});
    if(!state.caseReceipt){state.caseReceipt={workspace_id:workspace,tenant_id:b,status:'LEAD'};state.caseCreates=(state.caseCreates??0)+1;}
    if(state.invalidNext){state.invalidNext=false;res.writeHead(200,{'content-type':'application/json'});res.end('{');return;}
    send(res,200,{workspace:state.caseReceipt});return;
   }
   if(req.method==='GET'){
    if(state.deny){send(res,403,{error:{code:'FORBIDDEN'}});return;}
    if(u.pathname.endsWith('/building-setup')){send(res,200,{attempt:state.payload&&state.creationKey===u.searchParams.get('idempotency_key')?{version:2,workspace_id:workspace,revision:state.revision,run_id:run,status:state.stage,payload:state.payload,payload_hash:'a'.repeat(64),creation_request_hash:'b'.repeat(64),creation_receipt:state.creationReceipt,submitted_revision:['submitted','approved'].includes(state.stage)?(state.submittedRevision??state.revision):null,submitted_payload_hash:['submitted','approved'].includes(state.stage)?'a'.repeat(64):null,last_command_key:state.lastReceipt?.command_key??null,last_command_receipt:state.lastReceipt}:null});return;}
    if(!state.payload){send(res,404,{error:{code:'SETUP_NOT_FOUND'}});return;}
    send(res,200,{version:2,workspace_id:workspace,revision:state.revision,creation_request_hash:state.legacy?null:'b'.repeat(64),creation_receipt:state.creationReceipt,payload_hash:'a'.repeat(64),submitted_revision:['submitted','approved'].includes(state.stage)?(state.submittedRevision??state.revision):null,submitted_payload_hash:['submitted','approved'].includes(state.stage)?'a'.repeat(64):null,last_command_key:state.lastReceipt?.command_key??null,last_command_receipt:state.lastReceipt,run_id:run,status:state.stage,payload:state.payload,property_id:state.stage==='provisioned'?b:null,effective_units:null});return;
   }
   let text='';for await(const chunk of req)text+=chunk;
   const body=JSON.parse(text);state.posts.push({path:u.pathname,body:text});
   const key=body.command_key??body.idempotency_key;if(state.receipts.has(key)){send(res,200,state.receipts.get(key));return;}
   if(body.command_key&&body.expected_revision!==state.revision){send(res,409,{error:{code:'SETUP_REVISION_CONFLICT'}});return;}
   if(u.pathname.endsWith('/building-setup')){state.payload=body.payload;state.stage='draft';state.creationKey=body.idempotency_key;}
   if(req.method==='PATCH')state.payload.units=body.units;
   if(u.pathname.endsWith('/rehearse'))state.stage='rehearsed';
   if(u.pathname.endsWith('/submit')){state.stage='submitted';state.submittedRevision=state.revision+1;}
   if(u.pathname.endsWith('/approve')){state.submittedRevision??=state.revision;state.stage='approved';}
   if(u.pathname.endsWith('/provision')){state.stage='provisioned';state.provisions++;}
   if(body.command_key)state.revision++;
   const receipt={version:2,workspace_id:workspace,revision:state.revision,run_id:run,status:state.stage,...(body.command_key?{command_key:body.command_key,expected_revision:body.expected_revision,operation:req.method==='PATCH'?'update':u.pathname.split('/').at(-1)}:{creation_request_hash:'b'.repeat(64)})};
   state.receipts.set(key,receipt);if(body.command_key)state.lastReceipt=receipt;else state.creationReceipt=receipt;
   if(state.invalidNext){state.invalidNext=false;res.writeHead(200,{'content-type':'application/json'});res.end('{');return;}
   send(res,200,receipt);
  }catch(error){errors.push(String(error));if(!res.headersSent)send(res,500,{error:{code:'SYNTHETIC_TEST_FAILURE'}});else res.end();}
 });
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});origin=`http://127.0.0.1:${server.address().port}`;
 let executable;for(const path of ['/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()]){try{await access(path);executable=path;break;}catch{}}
 assert.ok(executable,'existing browser required, no download');
 browser=await chromium.launch({executablePath:executable,headless:true,timeout:60_000,args:['--no-sandbox']});
 for(const lang of ['en','ro','fa'])for(const width of (reviewOnly?[]:[390,1280])){
  state={revision:1,lastReceipt:null,creationKey:null,creationReceipt:null,receipts:new Map(),posts:[],payload:null,stage:'draft',provisions:0,invalidNext:false,deny:false};
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});contexts.add(context);
  await context.route('**/*',async route=>{if(new URL(route.request().url()).origin!==origin){receipt.external_requests++;await route.abort();}else await route.continue();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(String(error)));
  const names=copy[lang],button=i=>page.getByRole('button',{name:names[i],exact:true});
  await page.goto(`${origin}/${lang}`);await expect(page.getByRole('heading',{name:names[0]})).toBeVisible();await expect(button(1)).toBeEnabled();
  await button(1).focus();await page.keyboard.press('Enter');await expect(button(2)).toBeEnabled();assert.equal(state.posts.length,1);assert.equal(JSON.parse(state.posts[0].body).payload.currency,'RON');
  // Exercise saved-unit recovery in the real browser before the independent-approval path.
  await page.locator('input[min="0"][step="0.01"]').first().fill('70');
  const saveName={en:'Save units',ro:'Salvează unitățile',fa:'ذخیرهٔ واحدها'}[lang];
  await page.getByRole('button',{name:saveName,exact:true}).click();await expect(button(2)).toBeEnabled();assert.equal(state.payload.units[0].area_m2,70);
  // Commit rehearsal but send invalid JSON: recovery must read, not issue a second write.
  state.invalidNext=true;await button(2).click();await expect(button(6)).toBeEnabled();const posts=state.posts.length;
  await button(6).focus();await page.keyboard.press('Enter');await expect(button(3)).toBeEnabled();assert.equal(state.posts.length,posts);
  await button(3).click();const review=page.locator(`a[href="/${lang}/pilot-reviewer"]`);await expect(review).toBeVisible();await expect(button(4)).toBeDisabled();
  await review.focus();await page.keyboard.press('Tab');await expect(button(5)).toBeFocused();
  const beforeRefresh=state.posts.length;state.stage='approved';state.revision++;state.lastReceipt=null;await button(5).click();await expect(button(4)).toBeEnabled();assert.equal(state.posts.length,beforeRefresh);
  await button(4).click();await expect(page.locator('[aria-live="polite"]')).toContainText('PROVISIONED');assert.equal(state.provisions,1);
  await page.reload();await expect(button(1)).toBeDisabled();await expect(page.locator('[aria-live="polite"]')).toContainText('PROVISIONED');assert.equal(state.provisions,1);
  assert.equal(await page.locator('section').getAttribute('dir'),lang==='fa'?'rtl':'ltr');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'no horizontal mobile overflow');
  // Existing real Context guard: dirty form -> Keep preserves -> Discard changes without mutation.
  await page.locator('[data-context="B"]').click();await expect(page.locator('[data-active]')).toHaveText(b);const firstInput=page.locator('fieldset input').first();await firstInput.fill('Synthetic dirty draft');
  await page.locator('[data-context="A"]').click();await expect(page.locator('[data-pending]')).toHaveText(a);await page.locator('[data-keep]').click();await expect(firstInput).toHaveValue('Synthetic dirty draft');
  await page.locator('[data-context="A"]').click();const beforeNavigation=state.posts.length;await page.locator('[data-discard]').click();await expect(page.locator('[data-active]')).toHaveText(a);assert.equal(state.posts.length,beforeNavigation);
  receipt.cases.push({lang,width,result:'PASS',coverage:'keyboard/create/save-units/rehearse-lost-json/read-reconcile/submit/reviewer-handoff/external-approval-refresh/provision/remount/context-Keep-Discard/layout'});
  await context.close();contexts.delete(context);
 }

 const seed={association:{name:'Synthetic review'},building:{name:'Synthetic block',code:'B1',floors:1},currency:'RON',period_start:'2026-01-01',period_end:'2026-01-31',units:[{code:'U1',floor:0,area_m2:50}],opening_balances:[]};
 for(const lang of ['en','ro','fa'])for(const width of (reviewOnly?reviewWidths:[390,1280]))for(const view of (reviewOnly?['reviewer']:['reviewer','case'])){
  state={revision:3,lastReceipt:null,creationReceipt:{run_id:run},creationKey:null,receipts:new Map(),posts:[],payload:structuredClone(seed),stage:'submitted',provisions:0,invalidNext:true,deny:false};
  const context=await browser.newContext({viewport:{width,height:844}});contexts.add(context);
  await context.route('**/*',async route=>{if(new URL(route.request().url()).origin!==origin){receipt.external_requests++;await route.abort();}else await route.continue();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(`${origin}/${lang}?view=${view}`);
  if(lifecycleOnly){
   const labels={en:['Approve setup','Check and retry the same approval','Refresh review access'],ro:['Aprobă dosarul','Verifică și reîncearcă aceeași aprobare','Actualizează accesul la verificare'],fa:['تأیید پرونده','بررسی و تکرار همان تأیید','بررسی دسترسی بازبینی']};
   const key=`cladora.setup-approval.v2:${a}:${workspace}`,saved=()=>page.evaluate(key=>sessionStorage.getItem(key),key);
   const refresh=locale=>page.getByRole('button',{name:labels[locale][2],exact:true}),retry=locale=>page.getByRole('button',{name:labels[locale][1],exact:true});
   // Confirm denied -> authorized does not leave stale denied feedback, for each locale.
   const approve=()=>page.getByRole('button',{name:labels[lang][0],exact:true});
   await expect(approve()).toBeEnabled();state.reviewerDeny=403;await refresh(lang).click();await expect(approve()).toHaveCount(0);await expect(page.getByRole('status')).toBeVisible();state.reviewerDeny=null;await refresh(lang).click();await expect(approve()).toBeEnabled();await expect(page.getByRole('status')).toHaveCount(0);
   for(const target of (lang==='en'?['ro','fa']:['en'])){
    let started,release;const began=new Promise(resolve=>{started=resolve;}),held=new Promise(resolve=>{release=resolve;});let writes=0;
    await page.route('**/building-setup/*/approve',async route=>{writes++;started();await held;await route.abort('failed');});
    await approve().click();await began;const original=await saved();assert.ok(original);
    await page.evaluate(()=>{window.__reviewSection=document.querySelector('section');});
    await page.locator(`[data-review-lang="${target}"]`).click();assert.equal(await page.evaluate(()=>window.__reviewSection===document.querySelector('section')),true,'same component DOM identity across locale rerender');
    await expect(retry(target)).toBeDisabled();await refresh(target).click();await expect(retry(target)).toBeDisabled();release();await page.unrouteAll({behavior:'wait'});await expect(retry(target)).toBeEnabled();assert.equal(await saved(),original);assert.equal(writes,1);assert.equal(state.posts.length,0);
    assert.equal(await page.locator('section').getAttribute('dir'),target==='fa'?'rtl':'ltr');
    state.reviewerDeny=403;await refresh(target).click();await expect(retry(target)).toHaveCount(0);state.reviewerDeny=null;await refresh(target).click();await expect(retry(target)).toBeEnabled();
    await expect(page.getByRole('status')).toContainText(target==='en'?'unknown':target==='ro'?'necunoscut':'نامشخص');assert.equal(await saved(),original);
    state.invalidNext=false;await retry(target).focus();await page.keyboard.press('Enter');await expect(retry(target)).toHaveCount(0);assert.equal(state.posts.at(-1).body,JSON.stringify(JSON.parse(original).command));assert.equal(await saved(),null);
    await page.evaluate(()=>window.__reviewSection=null);await context.clearCookies();
    state.stage='submitted';state.revision=3;state.submittedRevision=3;state.lastReceipt=null;state.receipts.clear();state.posts=[];await page.reload();await expect(approve()).toBeEnabled();
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   receipt.cases.push({lang,width,view,result:'PASS',coverage:'same-instance-locale-rerender/held-POST/owned-busy-release/denied-authorized-feedback/unresolved-warning/exact-key-retry/keyboard/RTL'});await context.close();contexts.delete(context);continue;
  }
  if(view==='reviewer'){
   const label={en:'Approve setup',ro:'Aprobă dosarul',fa:'تأیید پرونده'}[lang];const retryLabel={en:'Check and retry the same approval',ro:'Verifică și reîncearcă aceeași aprobare',fa:'بررسی و تکرار همان تأیید'}[lang];
   const approve=page.getByRole('button',{name:label,exact:true});await expect(approve).toBeEnabled();const box=await approve.boundingBox();assert.ok(box.x>=-1&&box.x+box.width<=width+1,'review approval control fits viewport');await approve.focus();await page.keyboard.press('Enter');
   const retry=page.getByRole('button',{name:retryLabel,exact:true});await expect(retry).toBeEnabled();assert.equal(state.posts.length,1);const command=JSON.parse(state.posts[0].body);assert.equal(command.expected_revision,3);assert.equal(command.expected_payload_hash,'a'.repeat(64));
   await page.reload();await expect(retry).toBeEnabled();await retry.focus();await page.keyboard.press('Enter');await expect(retry).toHaveCount(0);assert.equal(state.posts.length,1,'lost approval reconciles recorded receipt without another POST');
   const refreshLabel={en:'Refresh review access',ro:'Actualizează accesul la verificare',fa:'بررسی دسترسی بازبینی'}[lang];
   const refresh=page.getByRole('button',{name:refreshLabel,exact:true});
   const key=`cladora.setup-approval.v2:${a}:${workspace}`;
   const saved=()=>page.evaluate(key=>sessionStorage.getItem(key),key);
   const submitted=()=>{state.stage='submitted';state.revision=3;state.lastReceipt=null;state.receipts.clear();state.invalidNext=false;state.reviewerDeny=null;state.deny=false;state.submittedRevision=3;};
   // Noncommitted network ambiguity -> reload -> identical command replay.
   submitted();await page.reload();await expect(approve).toBeEnabled();
   let attempts=[];
   await page.route('**/building-setup/*/approve',async route=>{attempts.push(route.request().postData());await route.abort('failed');});
   await approve.click();await expect(retry).toBeEnabled();const original=await saved();assert.ok(original);
   await page.reload();await expect(retry).toBeEnabled();
   await page.unroute('**/building-setup/*/approve');await retry.click();await expect(retry).toHaveCount(0);assert.equal(state.posts.at(-1).body,attempts[0]);assert.equal(await saved(),null);
   // 401/403 CURRENT access loss wipes sensitive state and hides recovery, without erasing key.
   for(const status of [401,403]){
    submitted();await page.reload();await expect(approve).toBeEnabled();
    await page.route('**/building-setup/*/approve',route=>route.abort('failed'));
    await approve.click();await expect(retry).toBeEnabled();const pending=await saved();const writes=state.posts.length;
    state.reviewerDeny=status;await refresh.click();await expect(approve).toHaveCount(0);await expect(retry).toHaveCount(0);await expect(page.getByText('Synthetic',{exact:false})).toHaveCount(0);assert.equal(await saved(),pending);assert.equal(state.posts.length,writes);
    state.reviewerDeny=null;await refresh.click();await expect(retry).toBeEnabled();
    state.deny=true;await retry.click();await expect(retry).toHaveCount(0);await expect(approve).toHaveCount(0);assert.equal(await saved(),pending);assert.equal(state.posts.length,writes);
    await page.unroute('**/building-setup/*/approve');await page.evaluate(key=>sessionStorage.removeItem(key),key);
   }
   // A previous reviewer read arriving after a newer denial cannot resurrect data.
   submitted();await page.reload();await expect(approve).toBeEnabled();
   let release,started;const began=new Promise(resolve=>{started=resolve;});const held=new Promise(resolve=>{release=resolve;});let reads=0;
   await page.route('**/api/customer/v1/pilot-reviewer',async route=>{
    if(++reads===1){started();await held;await route.fulfill({status:200,json:{reviewer:{status:'active',context_id:a,workspace_id:workspace,runs:[{id:run,workspace_id:workspace,status:'submitted',building:'Late sensitive record',revision:3,payload_hash:'a'.repeat(64),submitted_revision:3,submitted_payload_hash:'a'.repeat(64)}]}}});}
    else await route.fulfill({status:403,json:{error:{code:'FORBIDDEN'}}});
   });
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await began;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(approve).toHaveCount(0);release();await page.unrouteAll({behavior:'wait'});await expect(page.getByText('Late sensitive record',{exact:false})).toHaveCount(0);await expect(approve).toHaveCount(0);
   // Invalid stored Context and stale snapshots stay unresolved with zero POST.
   submitted();const foreign={run_id:run,command:{context_id:b,workspace_id:workspace,expected_revision:3,expected_payload_hash:'a'.repeat(64),command_key:`setup-${run}-r3-foreign`}};
   await page.evaluate(({key,value})=>sessionStorage.setItem(key,value),{key,value:JSON.stringify(foreign)});await page.reload();await expect(approve).toBeDisabled();await expect(retry).toHaveCount(0);assert.equal(await saved(),JSON.stringify(foreign));
   await page.evaluate(key=>sessionStorage.removeItem(key),key);await page.reload();await expect(approve).toBeEnabled();
   await page.route('**/building-setup/*/approve',route=>route.abort('failed'));await approve.click();await expect(retry).toBeEnabled();const stale=await saved(),writes=state.posts.length;await page.unroute('**/building-setup/*/approve');
   state.revision=4;await retry.click();await expect(retry).toBeEnabled();assert.equal(await saved(),stale);assert.equal(state.posts.length,writes);
   await page.evaluate(key=>sessionStorage.removeItem(key),key);
   // A submitted-hash mismatch must preserve the same unresolved attempt as well.
   submitted();await page.reload();await expect(approve).toBeEnabled();
   await page.route('**/building-setup/*/approve',route=>route.abort('failed'));await approve.click();await expect(retry).toBeEnabled();const hashAttempt=await saved(),hashWrites=state.posts.length;await page.unroute('**/building-setup/*/approve');
   await page.route('**/building-setup/*?*',async route=>{const response=await route.fetch();const record=await response.json();await route.fulfill({response,json:{...record,submitted_payload_hash:'c'.repeat(64)}});});
   await retry.click();await expect(retry).toBeEnabled();assert.equal(await saved(),hashAttempt);assert.equal(state.posts.length,hashWrites);await page.unrouteAll({behavior:'wait'});

  }else{
   const form=page.locator('form').filter({has:page.locator('select[name="taxonomy"]')});await expect(form.locator('select[name="taxonomy"] option')).toHaveCount(2);
   await form.locator('select[name="taxonomy"]').selectOption('0');await form.locator('input[name="commercial_owner"]').fill('Synthetic manager');await form.locator('input[name="reason"]').fill('Synthetic preparation reason');
   const prepare=form.getByRole('button');await prepare.focus();await page.keyboard.press('Enter');await expect(form.locator('input[name="commercial_owner"]')).toBeDisabled();await expect(prepare).toBeEnabled();assert.equal(state.caseCreates,1);const original=state.posts[0].body;
   await page.reload();await expect(form.locator('input[name="commercial_owner"]')).toBeDisabled();await expect(prepare).toBeEnabled();await prepare.focus();await page.keyboard.press('Enter');await expect(form.locator('input[name="commercial_owner"]')).toBeEnabled();assert.equal(state.caseCreates,1);assert.equal(state.posts.at(-1).body,original);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  receipt.cases.push({lang,width,view,result:'PASS',coverage:view==='reviewer'?'keyboard/exact-key-retry/committed-recovery/401-403-clear/denied-record-read/late-success-after-denial/foreign-attempt/stale-revision-hash/no-unintended-write/layout':'keyboard/immutable-attempt/snapshot/reload/recovery/no-duplicate-domain-effect/layout'});
  await context.close();contexts.delete(context);
 }

 for(const lang of (reviewOnly?[]:['en','ro','fa'])){
  state={legacy:true,revision:1,lastReceipt:null,creationReceipt:null,receipts:new Map(),posts:[],payload:structuredClone(seed),stage:'draft'};
  const context=await browser.newContext({viewport:{width:390,height:844}});contexts.add(context);
  await context.route('**/*',async route=>{if(new URL(route.request().url()).origin!==origin){receipt.external_requests++;await route.abort();}else await route.continue();});
  const page=await context.newPage();await page.goto(`${origin}/${lang}?run_id=${run}`);await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:copy[lang][2],exact:true})).toBeDisabled();assert.equal(state.posts.length,0);
  receipt.cases.push({lang,width:390,view:'legacy',result:'PASS',coverage:'unbound-historical-record/explicit-review/zero-mutation'});await context.close();contexts.delete(context);
 }
 assert.deepEqual(errors,[]);assert.equal(receipt.external_requests,0);console.log(JSON.stringify({...receipt,result:'PASS'}));
}finally{
 for(const context of contexts)await context.close();
 if(browser)await browser.close();
 if(compiler)await new Promise(resolve=>compiler.close(resolve));
 if(server)await new Promise(resolve=>server.close(resolve));
 if(temp)await rm(temp,{recursive:true,force:true});
}
