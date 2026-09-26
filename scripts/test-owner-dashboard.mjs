import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import React from 'react';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url));const m=new Module(filename);m.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);m._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return m.exports;}
const {ownerOverview}=load('src/lib/owner-portfolio/overview.ts');
const {ownerLabel}=load('src/lib/owner-portfolio/labels.ts');
const {annualCsv,csvCell}=load('src/lib/owner-portfolio/csv.ts',{'./labels':{ownerLabel}});
for(const lang of ['ro','en','fa']) {
 const report=annualCsv([{kind:'rent',direction:'income'}],lang);
 assert.ok(report.includes(ownerLabel(lang,'rent')));assert.ok(report.includes(ownerLabel(lang,'income')));
}
const units=[{id:'u1',status:'active'},{id:'u2',status:'active'},{id:'u3',status:'archived'}];
const lease=(id,unit_id,currency,starts_on,ends_on,status='active')=>({id,unit_id,currency,starts_on,ends_on,status,monthly_rent:'0.10'});
const leases=[lease('l1','u1','RON','2026-01-01','2026-10-20'),lease('l2','u1','EUR','2026-01-01',null),lease('l3','u2','RON','2027-01-01',null),lease('l4','u3','RON','2026-01-01',null),lease('l5','u2','RON','2026-01-01','2026-08-01')];
const cash=[{amount:'0.10',currency:'RON',direction:'income',paid_on:'2026-09-01'}, {amount:'0.20',currency:'RON',direction:'income',paid_on:'2026-09-26'},{amount:'8.00',currency:'EUR',direction:'expense',paid_on:'2026-09-26'}, {amount:'90',currency:'RON',direction:'income',paid_on:null,due_on:'2026-09-25'},{amount:'7',currency:'RON',direction:'expense',paid_on:null,due_on:'2026-09-25'},{amount:'80',currency:'RON',direction:'income',paid_on:null,due_on:'2026-09-26'},{amount:'99',currency:'RON',direction:'income',paid_on:'2026-10-01'},{amount:'77',currency:'RON',direction:'income',paid_on:'2026-08-01'}];
const o=ownerOverview(units,leases,cash,'2026-09-26');
assert.equal(o.unitCount,2);assert.equal(o.leasedUnitCount,1);assert.equal(o.overdue.length,2);assert.equal(o.expiring.length,2);
assert.deepEqual(o.currencies.find(x=>x.currency==='RON'),{currency:'RON',income:'0.30',expense:'0.00',overdueIncome:'90.00',overdueExpense:'7.00',monthlyRent:'0.10'});
assert.equal(o.currencies.find(x=>x.currency==='EUR').expense,'8.00');
const huge=ownerOverview([],[],Array.from({length:200},()=>({amount:'999999999999.99',currency:'RON',direction:'income',paid_on:'2026-09-01'})),'2026-09-26');
assert.equal(huge.currencies[0].income,'199999999999998.00');
assert.ok(csvCell(' =HYPERLINK("bad")').startsWith('"\''));assert.ok(annualCsv([{unit_id:'=1+1',amount:'10.20'}]).includes("'=1+1"));
const redirect=path=>{throw Object.assign(Error('redirect'),{path});};
function links(node){if(!node||typeof node!=='object')return [];return [...(node.props?.href?[node.props.href]:[]),...React.Children.toArray(node.props?.children).flatMap(links)];}
for(const lang of ['ro','en','fa'])for(const platform of [false,true])for(const owner of [false,true])for(const building of [false,true]){
 const db={auth:{getClaims:async()=>({data:{claims:{sub:'a'}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})}},schema:()=>({rpc:async name=>({data:name==='has_platform_access_v1'?platform:name==='my_multi_unit_owner_access_v1'?owner:building?[{id:'b'}]:[],error:null})})};
 const Page=load('src/app/[lang]/account/page.tsx',{'next/link':()=>null,'next/navigation':{redirect},'@/lib/supabase/server':{createClient:async()=>db},'@/types':{isSupportedLocale:l=>['ro','en','fa'].includes(l)},'@/components/auth/SignOutButton':{SignOutButton:()=>null}}).default;
 const props={params:Promise.resolve({lang}),searchParams:Promise.resolve({choose:'1'})};
 const hrefs=links(await Page(props));
 assert.equal(hrefs.includes(`/${lang}/owner-portfolio`),owner);assert.equal(hrefs.includes(`/${lang}/platform/overview`),platform);assert.equal(hrefs.includes(`/${lang}/app/dashboard`),building);
 if(Number(platform)+Number(owner)+Number(building)===1)await assert.rejects(()=>Page({...props,searchParams:Promise.resolve({})}),e=>e.path===`/${lang}/${owner?'owner-portfolio':platform?'platform/overview':'app/dashboard'}`);
}
// Exercise the actual overview route with paged RLS-session reads and fail-closed access.
for(const access of [true,false,'error']){
 let reads=0;
 const db={auth:{getClaims:async()=>({data:{claims:{sub:'a'}}})},schema:()=>({rpc:async()=>({data:access===true,error:access==='error'?Error('denied'):null})}),from:table=>({select(){return this;},order(){return this;},range:async(offset)=>{reads++;return {data:table==='owner_private_units'?(offset===0?Array.from({length:500},(_,i)=>({id:String(i),status:'active'})):[{id:'last',status:'active'}]):[],error:null};}})};
 const {GET}=load('src/app/api/owner-portfolio/v1/overview/route.ts',{'@/lib/supabase/server':{createClient:async()=>db},'@/lib/owner-portfolio/overview':{ownerOverview}});
 const response=await GET();assert.equal(response.status,access===true?200:403);if(access===true)assert.equal((await response.json()).unitCount,501);else assert.equal(reads,0);
}
// Update just the paid date of an unpaid row; missing/already-paid rows conflict.
const {NextRequest}=require('next/server');
for(const access of [true,false])for(const found of [true,false]){
 let updated=false,unpaid=false;
 const query={eq(){return this;},is(k,v){assert.equal(k,'paid_on');assert.equal(v,null);unpaid=true;return this;},select(){return this;},maybeSingle:async()=>({data:found?{id:'00000000-0000-4000-8000-000000000001'}:null,error:null})};
 const db={auth:{getClaims:async()=>({data:{claims:{sub:'a'}}})},schema:()=>({rpc:async()=>({data:access,error:null})}),from:table=>({update:fields=>{assert.equal(table,'owner_private_cash_entries');assert.deepEqual(fields,{paid_on:'2025-01-01'});updated=true;return query;}})};
 const {PATCH}=load('src/app/api/owner-portfolio/v1/cash/route.ts',{'@/lib/supabase/server':{createClient:async()=>db},'@/lib/security/same-origin':{hasTrustedMutationOrigin:()=>true},'@/lib/security/request-body':{isApplicationJson:()=>true,parseJsonWithLimit:async()=>({data:{entry_id:'00000000-0000-4000-8000-000000000001',paid_on:'2025-01-01'}})}});
 const response=await PATCH(new NextRequest('https://cladora.test/api/owner-portfolio/v1/cash',{method:'PATCH'}));assert.equal(response.status,!access?403:found?200:409);assert.equal(updated,access);assert.equal(unpaid,access);
}
console.log('PASS owner dashboard: exact money, currencies, dates, 24 role combinations, CSV safety, full pagination, access denial and payment transitions');
