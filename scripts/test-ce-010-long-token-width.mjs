// Only CE010-BR-01 three exact fixtures + directly related native controls.
// Actual Page/Base/client/schema/session modules; only Context and read transport
// are fixtures. Browser geometry is not Next/Auth/DB/hosted or command proof.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {communityReadResponseSchema} from '../src/lib/community/community-base-client.ts';
const require=createRequire(import.meta.url),ts=require('typescript'),{chromium}=require('playwright');
const repo=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ce010-long-token-'));
const override=process.env.CE010_WIDTH_SOURCE;
const observeBefore=process.argv.includes('--observe-before');
const communityName='SYNTHETICCommunity'+'A'.repeat(102),title='SYNTHETICAnnouncement'+'B'.repeat(99);
assert.equal(communityName.length,120);assert.equal(title.length,120);
const id=n=>`28000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const payload={workspace_id:id(2),limit:100,communities:[{id:id(3),workspace_id:id(2),name:communityName,version:3,audience_kind:'workspace',can_create_announcement:true,can_decide_reports:false}],announcements:[{id:id(4),community_id:id(3),title,body:'Synthetic read-only layout fixture.',status:'published',version:2,can_report:true,can_publish:false,can_cancel:false}],reports:[]};
communityReadResponseSchema.parse(payload);
assert.equal(communityReadResponseSchema.safeParse({...payload,communities:[{...payload.communities[0],name:communityName+'A'}]}).success,false);
assert.equal(communityReadResponseSchema.safeParse({...payload,announcements:[{...payload.announcements[0],title:title+'B'}]}).success,false);
const modules={},imports={};
const special={react:'react/cjs/react.production.js','react-dom':'react-dom/cjs/react-dom.production.js','react-dom/client':'react-dom/cjs/react-dom-client.production.js',scheduler:'scheduler/cjs/scheduler.production.js','react/jsx-runtime':'react/cjs/react-jsx-runtime.production.js'};
for(const[k,v]of Object.entries(special)){const parts=v.split('/');special[k]=path.join(path.dirname(require.resolve(parts[0]+'/package.json')),...parts.slice(1));}
const mockContext='fixture:context',mockTransport='fixture:transport';
modules[mockContext]=`const ctx={active:{context_id:'${id(1)}',membership_id:'${id(5)}'},dashboard:{contextId:'${id(1)}',workspace_id:'${id(2)}'},loading:false,pendingContextId:null,registerUnsavedGuard:()=>()=>{}};exports.useCustomerContext=()=>ctx;`;
modules[mockTransport]=`const fetch=async(url,init={})=>{if(init.method&&init.method!=='GET'){window.fixtureCommands++;throw Error('UNEXPECTED_COMMAND');}if(!url.startsWith('/api/customer/v1/community/base?'))throw Error('UNEXPECTED_READ');window.fixtureReads++;return {ok:true,status:200,json:async()=>window.fixturePayload};};exports.useDashboardFetch=()=>fetch;`;
function resolve(name,from){if(name==='./CustomerContextProvider')return mockContext;if(name==='@/components/dashboard-lab/DashboardTransport')return mockTransport;if(special[name])return special[name];
 let p=name.startsWith('@/')?path.join(repo,'src',name.slice(2)):name.startsWith('.')?path.resolve(path.dirname(from),name):null;
 if(p){if(fs.existsSync(p)&&fs.statSync(p).isFile())return p;for(const ext of ['.ts','.tsx','.js','.cjs'])if(fs.existsSync(p+ext))return p+ext;throw Error('missing '+p);}
 return require.resolve(name,{paths:[path.dirname(from)]});}
function collect(filename){if(Object.hasOwn(modules,filename))return;let sourceFile=filename;
 if(override&&['CustomerCommunityBase.tsx','CustomerCommunityBasePage.tsx'].includes(path.basename(filename)))sourceFile=path.join(override,path.basename(filename));
 let content=fs.readFileSync(sourceFile,'utf8');if(/\.tsx?$/.test(filename))content=ts.transpileModule(content,{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 modules[filename]=content;imports[filename]={};
 for(const match of content.matchAll(/\brequire\(["']([^"']+)["']\)/g)){const dep=resolve(match[1],filename);imports[filename][match[1]]=dep;collect(dep);}
}
const entry=path.join(repo,'src/components/customer/CustomerCommunityBasePage.tsx');collect(entry);collect(special['react-dom/client']);collect(special.react);
const bundle=`var process={env:{NODE_ENV:'production'}};const imports=${JSON.stringify(imports)};const factories={${Object.entries(modules).map(([key,code])=>JSON.stringify(key)+':function(module,exports,require){'+code+'\n}').join(',')}};const cache={};function load(k){if(cache[k])return cache[k].exports;const m={exports:{}};cache[k]=m;factories[k](m,m.exports,n=>load(imports[k][n]));return m.exports;}window.React=load(${JSON.stringify(special.react)});window.createRoot=load(${JSON.stringify(special['react-dom/client'])}).createRoot;window.Page=load(${JSON.stringify(entry)}).CustomerCommunityBasePage;`;
const contentPaths=[];
for(const name of ['CustomerCommunityBase.tsx','CustomerCommunityBasePage.tsx']){const src=override?path.join(override,name):path.join(repo,'src/components/customer',name);const dest=path.join(temp,name);fs.copyFileSync(src,dest);contentPaths.push(dest);}
fs.writeFileSync(path.join(temp,'input.css'),'@tailwind base;@tailwind components;@tailwind utilities;');
execFileSync(process.execPath,['node_modules/tailwindcss/lib/cli.js','-i',path.join(temp,'input.css'),'-o',path.join(temp,'styles.css'),'--config','tailwind.config.js','--content',contentPaths.join(',')],{stdio:'pipe'});
let browser;const cases=[];
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-background-networking']});
 for(const lang of ['fa','en','ro']){
  const page=await browser.newPage({viewport:{width:375,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort());
  await page.setContent('<body style="font-family: Noto Sans, Noto Sans Arabic, sans-serif"><div id="root" style="padding:16px;width:100%;box-sizing:border-box"></div></body>');
  await page.evaluate(dir=>{document.documentElement.dir=dir;},lang==='fa'?'rtl':'ltr');
  await page.addStyleTag({content:fs.readFileSync(path.join(temp,'styles.css'),'utf8')});await page.evaluate(p=>{window.fixturePayload=p;window.fixtureReads=0;window.fixtureCommands=0;},payload);await page.addScriptTag({content:bundle});
  await page.evaluate(lang=>window.createRoot(document.getElementById('root')).render(window.React.createElement(window.Page,{lang})),lang);
  const select=page.locator('select[aria-label]');await select.waitFor();await page.getByRole('heading',{name:communityName,exact:true}).waitFor();
  await select.focus();await select.press('Home');assert.equal(await select.inputValue(),id(3));
  const chosen=await select.evaluate(s=>s.selectedOptions[0].textContent);assert.equal(chosen,communityName);
  await select.press('Tab');assert.equal(await page.locator('[data-community-refresh]').evaluate(e=>document.activeElement===e),true);await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByRole('combobox',{name:lang==='fa'?'انتخاب جامعه':lang==='ro'?'Alege comunitatea':'Choose a community',exact:true}).count(),1);
  assert.equal(await page.getByRole('heading',{name:communityName,exact:true}).textContent(),communityName);assert.equal(await page.getByRole('heading',{name:title,exact:true}).textContent(),title);
  const measurement=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width}};const titles=[document.getElementById('ce010-community-title'),document.querySelector('article h2')];const select=document.querySelector('select[aria-label]');return{document:document.documentElement.scrollWidth,body:document.body.scrollWidth,viewport:innerWidth,bodyOverflow:getComputedStyle(document.body).overflowX,select:rect(select),focused:document.activeElement===select,direction:select.closest('section').dir,outline:getComputedStyle(select).outlineStyle,reads:window.fixtureReads,commands:window.fixtureCommands,titles:titles.map(e=>{const range=document.createRange();range.selectNodeContents(e);return{...rect(e),text:e.textContent,font:getComputedStyle(e).fontFamily,fontSize:getComputedStyle(e).fontSize,overflow:getComputedStyle(e).overflow,whiteSpace:getComputedStyle(e).whiteSpace,lines:Array.from(range.getClientRects()).map(r=>({left:r.left,right:r.right,width:r.width}))}})};});
  const fits=measurement.document<=375&&measurement.body<=375&&measurement.titles.every(t=>t.left>=0&&t.right<=375&&t.lines.every(r=>r.left>=-0.5&&r.right<=375.5));
  const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const doc=await cdp.send('DOM.getDocument');const node=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#ce010-community-title'});const fonts=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});await cdp.detach();
  cases.push({lang,platformFonts:fonts.fonts,fixture:{community:communityName,title},fits,...measurement});
  assert.equal(errors.length,0);assert.equal(measurement.commands,0);assert.equal(measurement.focused,true);assert.equal(measurement.direction,lang==='fa'?'rtl':'ltr');assert.notEqual(measurement.bodyOverflow,'hidden');assert.notEqual(measurement.bodyOverflow,'clip');
  if(!observeBefore)assert.ok(fits,JSON.stringify(measurement));
  await page.close();
 }
 console.log(JSON.stringify({result:observeBefore?'BEFORE_OBSERVATION_NOT_PASS':'PASS_NATIVE_TARGETED',browser:browser.version(),cases,evidence:'Actual Page/Base/client/schema/session + emitted Tailwind CSS; fixture Context/read transport; no Next/AppShell/Auth/DB/command execution'},null,2));
}finally{if(browser)await browser.close();fs.rmSync(temp,{recursive:true,force:true});}
