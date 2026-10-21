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
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const component=join(root,'src/components/customer/CustomerBuildingSetupWizard.tsx'),provider=join(root,'src/components/customer/CustomerContextProvider.tsx');
const a='80000000-0000-0000-0000-000000000004',b='80000000-0000-0000-0000-000000000006',run='80000000-0000-0000-0000-000000000005';
const copy={en:['Controlled building setup','Create draft','Run rehearsal','Submit for approval','Provision structure','Refresh saved status','Check status and retry saved attempt'],ro:['Configurare controlată a clădirii','Creează proiect','Rulează simularea','Trimite spre aprobare','Creează structura','Actualizează starea salvată','Verifică starea și reîncearcă operațiunea salvată'],fa:['راه‌اندازی کنترل‌شده ساختمان','ایجاد پیش‌نویس','اجرای آزمایشی','ارسال برای تأیید','ایجاد ساختار','دریافت وضعیت ثبت‌شده','بررسی وضعیت و تکرار همان تلاش']};
let browser,server,compiler,temp,state,origin;const contexts=new Set(),errors=[],requests=[];
const receipt={suite:'PROCEDURE-BUILDING-WORKSPACE-SLICE-01',boundary:'REAL_CHROMIUM_ACTUAL_REACT_CONTEXT_AND_CSS_SYNTHETIC_LOOPBACK_API',real_auth_rpc_db:'NOT_RUN_NOT_PASS',physical_device:'NOT_RUN_NOT_PASS',cases:[],external_requests:0};
const send=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
try{
 temp=await mkdtemp(join(tmpdir(),'building-setup-browser-'));const entry=join(temp,'entry.tsx'),loader=join(temp,'loader.cjs');
 await writeFile(loader,`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;`);
 await writeFile(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import {CustomerContextProvider,useCustomerContext} from ${JSON.stringify(provider)};import {CustomerBuildingSetupWizard} from ${JSON.stringify(component)};
 function Fixture(){const c=useCustomerContext();return <><nav aria-label="Synthetic Context controls"><button onClick={()=>c.select('${a}')} data-context="A">A</button><button onClick={()=>c.select('${b}')} data-context="B">B</button><button onClick={c.cancelContextChange} data-keep>Keep</button><button onClick={c.confirmContextChange} data-discard>Discard</button><output data-active>{c.active?.context_id}</output><output data-pending>{c.pendingContextId}</output></nav><CustomerBuildingSetupWizard lang={document.documentElement.lang}/></>;}createRoot(document.getElementById('root')).render(<CustomerContextProvider><Fixture/></CustomerContextProvider>);`);
 const webpack=require('next/dist/compiled/webpack/webpack').webpack;
 compiler=webpack({mode:'development',devtool:false,target:'web',entry,output:{path:temp,filename:'app.js'},plugins:[new webpack.ProvidePlugin({process:require.resolve('next/dist/build/polyfills/process')})],resolve:{extensions:['.tsx','.ts','.js','.json'],modules:[join(root,'node_modules')],alias:{'@':join(root,'src')}},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:[{loader}]}]}});
 await new Promise((yes,no)=>compiler.run((error,stats)=>error||stats.hasErrors()?no(Error(stats?.toString({all:false,errors:true})??String(error))):yes()));
 await new Promise((yes,no)=>compiler.close(error=>error?no(error):yes()));compiler=null;
 const css=await require('postcss')([require('tailwindcss')({...require(join(root,'tailwind.config.js')),content:[component,provider,entry]})]).process(await readFile(join(root,'src/styles/globals.css'),'utf8'),{from:join(root,'src/styles/globals.css')});
 const js=await readFile(join(temp,'app.js'));
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
   if(u.pathname.endsWith('/dashboard')){send(res,200,{contextId:u.searchParams.get('context_id')});return;}
   if(req.method==='GET'){
    if(state.deny){send(res,403,{error:{code:'FORBIDDEN'}});return;}
    if(!state.payload){send(res,404,{error:{code:'SETUP_NOT_FOUND'}});return;}
    send(res,200,{run_id:run,status:state.stage,payload:state.payload,property_id:state.stage==='provisioned'?b:null,effective_units:null});return;
   }
   let text='';for await(const chunk of req)text+=chunk;
   const body=JSON.parse(text);state.posts.push({path:u.pathname,body:text});
   if(u.pathname.endsWith('/building-setup')){state.payload=body.payload;state.stage='draft';}
   if(req.method==='PATCH')state.payload.units=body.units;
   if(u.pathname.endsWith('/rehearse'))state.stage='rehearsed';
   if(u.pathname.endsWith('/submit'))state.stage='submitted';
   if(u.pathname.endsWith('/provision')){state.stage='provisioned';state.provisions++;}
   if(state.invalidNext){state.invalidNext=false;res.writeHead(200,{'content-type':'application/json'});res.end('{');return;}
   send(res,200,{run_id:run,status:state.stage});
  }catch(error){errors.push(String(error));if(!res.headersSent)send(res,500,{error:{code:'SYNTHETIC_TEST_FAILURE'}});else res.end();}
 });
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});origin=`http://127.0.0.1:${server.address().port}`;
 let executable;for(const path of ['/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()]){try{await access(path);executable=path;break;}catch{}}
 assert.ok(executable,'existing browser required, no download');
 browser=await chromium.launch({executablePath:executable,headless:true,timeout:60_000,args:['--no-sandbox']});
 for(const lang of ['en','ro','fa'])for(const width of [390,1280]){
  state={posts:[],payload:null,stage:'draft',provisions:0,invalidNext:false,deny:false};
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
  const beforeRefresh=state.posts.length;state.stage='approved';await button(5).click();await expect(button(4)).toBeEnabled();assert.equal(state.posts.length,beforeRefresh);
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
 assert.deepEqual(errors,[]);assert.equal(receipt.external_requests,0);console.log(JSON.stringify({...receipt,result:'PASS'}));
}finally{
 for(const context of contexts)await context.close();
 if(browser)await browser.close();
 if(compiler)await new Promise(resolve=>compiler.close(resolve));
 if(server)await new Promise(resolve=>server.close(resolve));
 if(temp)await rm(temp,{recursive:true,force:true});
}
