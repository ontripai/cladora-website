// Native Chromium + actual component + repository-emitted Tailwind CSS.
// Only projection transport/decoding helpers are fixture adapters; no Auth/DB/Next proof.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require=createRequire(import.meta.url), ts=require('typescript'), {chromium}=require('playwright');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ce-selector-'));
const source=process.env.CE_SELECTOR_SOURCE ?? 'src/components/customer/CustomerEventAttendanceTargets.tsx';
const text=fs.readFileSync(source,'utf8');
const modules={};
for(const [name,file] of Object.entries({react:'react/cjs/react.production.js','react-dom':'react-dom/cjs/react-dom.production.js',client:'react-dom/cjs/react-dom-client.production.js',scheduler:'scheduler/cjs/scheduler.production.js','react/jsx-runtime':'react/cjs/react-jsx-runtime.production.js'})) {
 const parts=file.split('/');modules[name]=fs.readFileSync(path.join(path.dirname(require.resolve(parts[0]+'/package.json')),...parts.slice(1)),'utf8');
}
modules.component=ts.transpileModule(text,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
modules['@/lib/community/event-interest-client']=`exports.sameEventUuid=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();`;
modules['@/lib/community/event-attendance-client']=`exports.attendanceReadUrl=()=>'/fixture';exports.parseAttendanceReadResponse=x=>x;`;
const bundle=`var process={env:{NODE_ENV:'production'}};const factories={${Object.entries(modules).map(([k,v])=>JSON.stringify(k)+':function(module,exports,require){'+v+'\n}').join(',')}};const cache={};function require(k){if(cache[k])return cache[k].exports;const m={exports:{}};cache[k]=m;factories[k](m,m.exports,require);return m.exports;}window.React=require('react');window.createRoot=require('client').createRoot;window.Component=require('component').CustomerEventAttendanceTargets;`;
fs.writeFileSync(path.join(temp,'component.tsx'),text);fs.writeFileSync(path.join(temp,'input.css'),'@tailwind base;@tailwind components;@tailwind utilities;');
execFileSync(process.execPath,['node_modules/tailwindcss/lib/cli.js','-i',path.join(temp,'input.css'),'-o',path.join(temp,'styles.css'),'--config','tailwind.config.js','--content',path.join(temp,'component.tsx')],{stdio:'pipe'});
let browser;
const cases=[];
try {
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-background-networking']});
 for(const lang of ['fa','en','ro']) {
 const page=await browser.newPage({viewport:{width:375,height:812}});await page.route('**/*',route=>route.abort());
 await page.setContent('<div id="root" style="padding:16px;width:100%;box-sizing:border-box"></div>');await page.addStyleTag({content:fs.readFileSync(path.join(temp,'styles.css'),'utf8')});await page.addScriptTag({content:bundle});
 const name=({'fa':'م','en':'W','ro':'Ș'})[lang].repeat(120);
 await page.evaluate(({lang,name})=>{const R=window.React;window.expectedName=name;const event={event_id:'event',workspace_id:'workspace',occurrence_id:'occurrence',version:7,status:'published',timezone:'Europe/Bucharest'};
 const response={targets:[{attendance_id:'attendance',attendance_version:4,membership_id:'member',display_name:name,attended:true,observed_local:'2026-11-02T12:00:00'}],event_id:'event',event_version:7,timezone:event.timezone,next_cursor:null};
 window.createRoot(document.getElementById('root')).render(R.createElement(window.Component,{lang,contextId:'context',event,enabled:true,locked:false,scopeOwner:{},current:()=>true,denied:()=>{throw Error('unexpected denial')},fetch:async()=>({ok:true,status:200,json:async()=>response}),children:p=>R.createElement('output',{'data-chosen':true},p?JSON.stringify(p.correction):'')}));},{lang,name});
 const select=page.locator('[data-attendance-target]');await select.waitFor();await select.focus();await select.press('Home');await select.press('ArrowDown');await select.press('Tab');await page.waitForFunction(()=>document.querySelector('[data-chosen]').textContent.includes('"version":4'));
 // Do not let the diagnostic JSON output itself cause page overflow.
 await page.locator('[data-chosen]').evaluate(e=>e.style.display='none');
 assert.equal(await page.getByRole('combobox', {name:({fa:'انتخاب شرکت‌کنندهٔ ثبت‌شده',en:'Choose a recorded participant',ro:'Alege un participant înregistrat'})[lang],exact:true}).count(),1);
 const binding=JSON.parse(await page.locator('[data-chosen]').textContent());assert.deepEqual(binding,{id:'attendance',version:4,timezone:'Europe/Bucharest',displayName:name});
 await select.focus();await select.press('Shift+Tab');assert.equal(await page.locator('[data-attendance-refresh]').evaluate(e=>document.activeElement===e),true);await page.keyboard.press('Tab');
 assert.equal(await select.getAttribute('aria-describedby'),await page.locator('[data-attendance-snapshot]').getAttribute('id'));
 const measurement=await page.evaluate(()=>{const s=document.querySelector('select'),r=s.getBoundingClientRect(),p=document.querySelector('[data-attendance-snapshot]');return{document:document.documentElement.scrollWidth,viewport:innerWidth,select:r.width,left:r.left,right:r.right,focused:document.activeElement===s,dir:s.closest('section').dir,fullName:s.selectedOptions[0].textContent===window.expectedName,snapshot:p.textContent.includes(window.expectedName),accessibleLabel:s.labels[0].textContent,outline:getComputedStyle(s).outlineStyle,ring:getComputedStyle(s).boxShadow};});
 cases.push({lang,...measurement});assert.equal(measurement.fullName,true);assert.equal(measurement.snapshot,true);assert.ok(measurement.accessibleLabel);assert.equal(measurement.focused,true);assert.equal(measurement.dir,lang==='fa'?'rtl':'ltr');
 assert.ok(measurement.document<=375,JSON.stringify(measurement));assert.ok(measurement.left>=0&&measurement.right<=375,JSON.stringify(measurement));assert.ok(measurement.outline!=='none'||measurement.ring!=='none');await page.close();
 }
 console.log(JSON.stringify({result:'PASS_NATIVE_CONTROLLED_COMPONENT',browser:browser.version(),cases,evidence:'Actual component, emitted repository Tailwind CSS, native select/keyboard/focus; fixture projection adapters; not Next/Auth/DB'},null,2));
} finally {if(browser)await browser.close();fs.rmSync(temp,{recursive:true,force:true});}
