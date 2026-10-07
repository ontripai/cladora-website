import {PERSONA_ACCESS_MATRIX,isCanonicalRole} from '@/lib/customer/access-matrix';
import {ownerOverview,type OwnerUnit,type OwnerLease,type OwnerCash} from '@/lib/owner-portfolio/overview';
import {annualCsv} from '@/lib/owner-portfolio/csv';
import {labRoleName,type LabRole} from './catalog';
import type {Language} from '@/types';
import type {DashboardFetch} from '@/components/dashboard-lab/DashboardTransport';
// In-memory fixtures only. There is deliberately no fetch fallback or Supabase client.
export function createLabTransport(role:LabRole,lang:Language,scenario:'sample'|'empty'|'error'='sample'):DashboardFetch {
 const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const date=(days:number)=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
 const name=lang==='fa'?'ساختمان آزمایشی':lang==='ro'?'Clădire de test':'Test building';
 let seq=100;
 const units:Array<OwnerUnit&{usage_kind:string}>=scenario==='empty'?[]:[{id:id(1),building_label:name,unit_label:'A12',address_text:lang==='fa'?'نشانی فرضی، بخارست':lang==='ro'?'Adresă fictivă, București':'Fictional address, Bucharest',status:'active',usage_kind:'residential'},{id:id(2),building_label:name,unit_label:'B4',address_text:lang==='fa'?'نشانی فرضی دوم':lang==='ro'?'A doua adresă fictivă':'Second fictional address',status:'active',usage_kind:'office'}];
 const leases:OwnerLease[]=scenario==='empty'?[]:[{id:id(11),unit_id:id(1),tenant_label:lang==='fa'?'مستأجر آزمایشی':lang==='ro'?'Chiriaș de test':'Test tenant',starts_on:date(-90),ends_on:date(30),monthly_rent:2500,currency:'RON',status:'active'}];
 const cash:Array<OwnerCash&{lease_id:string|null;source:string}>=scenario==='empty'?[]:[{id:id(21),unit_id:id(1),kind:'rent',direction:'income',amount:2500,currency:'RON',due_on:date(-7),paid_on:null,memo:null,lease_id:null,source:'self_reported'},{id:id(22),unit_id:id(2),kind:'owner_expense',direction:'expense',amount:150,currency:'EUR',due_on:today,paid_on:today,memo:null,lease_id:null,source:'self_reported'}];
 const links:Array<Record<string,unknown>>=scenario==='empty'?[]:[{id:id(70),private_unit_id:id(1),workspace_id:id(71),canonical_unit_id:id(72),status:'linked'}];
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 return async(input,init)=>{
  const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  const url=new URL(raw,'https://dashboard-lab.invalid');
  if(url.origin!=='https://dashboard-lab.invalid')return json({error:'LAB_EXTERNAL_REQUEST_BLOCKED'},403);
  if(scenario==='error')return json({error:'LAB_SIMULATED_ERROR'},503);
  const method=init?.method??'GET';
  const path=url.pathname;
  const b=init?.body?JSON.parse(String(init.body)):{};
  if(role==='multi_unit_owner'&&path.startsWith('/api/owner-portfolio/v1')){
   const endpoint='/api/owner-portfolio/v1';
   if(path===endpoint+'/overview'&&method==='GET')return json(ownerOverview(units,leases,cash,today));
   if(path===endpoint+'/annual'&&method==='GET'){
    const year=url.searchParams.get('year');const groups:Record<string,unknown>[]=[];
    for(const e of cash.filter(e=>e.paid_on?.startsWith(`${year}-`))){let g=groups.find(g=>g.unit_id===e.unit_id&&g.currency===e.currency&&g.kind===e.kind&&g.direction===e.direction);if(!g){g={unit_id:e.unit_id,currency:e.currency,kind:e.kind,direction:e.direction,entry_count:0,amount:0};groups.push(g)}g.entry_count=Number(g.entry_count)+1;g.amount=Math.round((Number(g.amount)+Number(e.amount))*100)/100;}
    return url.searchParams.get('format')==='csv'?new Response(annualCsv(groups,lang),{headers:{'Content-Type':'text/csv; charset=utf-8'}}):json({groups});
   }
   if(path===endpoint+'/cash'&&method==='PATCH'){const entry=cash.find(e=>e.id===b.entry_id&&!e.paid_on);if(!entry||!/^\d{4}-\d{2}-\d{2}$/.test(b.paid_on)||b.paid_on>today)return json({error:'INVALID_PAYMENT'},409);entry.paid_on=b.paid_on;return json({entry});}
   if(path===endpoint+'/links'){
    if(method==='GET')return json({links});
    if(method==='POST'&&b.action==='request'){links.push({id:id(seq++),private_unit_id:b.private_unit_id,workspace_id:b.workspace_id,canonical_unit_id:b.canonical_unit_id,status:'requested'});return json({ok:true});}
    if(method==='POST'&&b.action==='withdraw'){const link=links.find(l=>l.id===b.link_id);if(link)link.status='withdrawn';return json({ok:!!link});}
   }
   if(path===endpoint+'/charges'&&method==='GET')return json({charges:links.some(l=>l.private_unit_id===url.searchParams.get('private_unit_id')&&l.status==='linked')?[{id:id(73),invoice_no:1001,total:300,outstanding_amount:300,currency:'RON',status:'issued',due_on:date(7)}]:[]});
   if(path===endpoint&&method==='GET'){
    const unit=url.searchParams.get('unit_id');const offset=Number(url.searchParams.get('offset')??0),details=Number(url.searchParams.get('details_offset')??0);
    const ls=leases.filter(l=>l.unit_id===unit),es=cash.filter(e=>e.unit_id===unit);
    return json({units:units.slice(offset,offset+50),count:units.length,leases:ls.slice(details,details+100),entries:es.slice(details,details+100),lease_count:ls.length,entry_count:es.length});
   }
   if(path===endpoint&&method==='POST'){
    const entryId=id(seq++);
    if(b.action==='unit')units.push({id:entryId,building_label:b.building_label,unit_label:b.unit_label,address_text:b.address_text,usage_kind:b.usage_kind,status:'active'});
    else if(!units.some(u=>u.id===b.unit_id))return json({error:'UNIT_MISSING'},400);
    else if(b.action==='lease')leases.push({id:entryId,unit_id:b.unit_id,tenant_label:b.tenant_label,starts_on:b.starts_on,ends_on:b.ends_on,monthly_rent:b.monthly_rent,currency:b.currency,status:'draft'});
    else if(b.action==='cash')cash.push({id:entryId,unit_id:b.unit_id,kind:b.kind,direction:b.direction,amount:b.amount,currency:b.currency,due_on:b.due_on,paid_on:b.paid_on,memo:b.memo,lease_id:b.lease_id,source:'self_reported'});
    else return json({error:'UNKNOWN_ACTION'},400);
    return json({id:entryId});
   }
   if(path===endpoint&&method==='PATCH'){const l=leases.find(l=>l.id===b.lease_id);const next=b.transition==='activate'?'active':b.transition==='end'?'ended':b.transition==='cancel'?'cancelled':null;if(!l||!next||!((l.status==='draft'&&['active','cancelled'].includes(next))||(l.status==='active'&&next==='ended')))return json({error:'INVALID_TRANSITION'},409);l.status=next;return json({lease:l});}
  }
  if(isCanonicalRole(role)&&method==='GET'){
   const context={context_id:id(30),tenant_name:name,role_code:role,role_name:labRoleName(role,lang),scope_type:['owner','tenant_resident'].includes(role)?'unit':'tenant',context_label:name};
   const moduleNames:Record<string,{ro:string;en:string;fa:string}>={accounting:{ro:'Contabilitate',en:'Accounting',fa:'حسابداری'},billing:{ro:'Facturare',en:'Billing',fa:'صورتحساب'},maintenance:{ro:'Mentenanță',en:'Maintenance',fa:'نگهداری'},utilities:{ro:'Utilități',en:'Utilities',fa:'انشعابات'},governance:{ro:'Guvernanță',en:'Governance',fa:'حاکمیت'},communications:{ro:'Comunicări',en:'Communications',fa:'ارتباطات'}};
   const modules=['accounting','billing','maintenance','utilities','governance','communications'];
   if(path==='/api/customer/v1/contexts')return json({contexts:scenario==='empty'?[]:[context]});
   if(path==='/api/customer/v1/dashboard')return json({version:1,persona:role,contextId:id(30),workspace_id:id(31),context:{id:id(30),tenant_id:id(31),tenant_name:name,role_code:role,role_name:labRoleName(role,lang),scope_type:context.scope_type},sections:[...PERSONA_ACCESS_MATRIX[role].allowedSections],capabilities:[...PERSONA_ACCESS_MATRIX[role].allowedCapabilities],permissions:['maintenance.assets.read','billing.receivables.read','finance.ledger.read','communications.feed.read','utilities.metering.read','governance.meetings.read','audit.events.read'],modules,entitlements:modules.map(m=>'module.'+m),kpis:{properties:2,buildings:2,units:24,open_work_orders:3,unread_notifications:2,outstanding_amount:1250,my_units_count:1,my_open_requests:2,my_open_tickets:1,financial_records:18},generated_at:new Date().toISOString()});
   if(path==='/api/customer/v1/workspace/taxonomy')return json({data:{has_assignment:true,status:'active',workspace_id:id(31),country_code:'RO',profile:{id:id(32),code:'residential',version:1,name,labels:{ro:'Rezidențial',en:'Residential',fa:'مسکونی'}},operating_model:{id:id(33),code:'association',version:1,name,labels:{ro:'Asociație',en:'Association',fa:'انجمن'}},allowed_space_kinds:[]}});
   if(path==='/api/customer/v1/workspace/composition')return json({data:{has_assignment:true,status:'active',workspace_id:id(31),modules:modules.map((code,i)=>({module_definition_id:id(40+i),code,version:1,name:code,labels:moduleNames[code],category:'core',sensitivity_level:'standard',requires_aal2:false,lifecycle_status:'active',workspace_module_id:id(50+i),status:'active',is_installed:true,is_entitled:true,is_compatible:true,can_activate:false,can_deactivate:false}))}});
  }
  if(role.startsWith('PLATFORM_')&&path==='/api/platform/v1/overview'&&method==='GET')return json({generated_at:new Date().toISOString(),capabilities:{commercial:['PLATFORM_SUPER_ADMIN','PLATFORM_FINANCE','PLATFORM_AUDITOR'].includes(role),operational:['PLATFORM_SUPER_ADMIN','PLATFORM_OPERATIONS','PLATFORM_AUDITOR'].includes(role),audit:true},kpis:{workspaces:scenario==='empty'?0:3,active_contracts:scenario==='empty'?0:2,plans:scenario==='empty'?0:2,provisioning_attention:0,support_open:scenario==='empty'?0:1,audit_recent:0},attention:[],recent_events:[]});
  return json({error:'LAB_ROUTE_NOT_SUPPORTED'},403);
 };
}
