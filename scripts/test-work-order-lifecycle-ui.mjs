import assert from 'node:assert/strict';
import {createHarness,runAdmissionRegression,defer,response,workOrder,ID,OTHER,CTX,CTX2,VENDOR,TIME} from './test-work-order-checklist-ui-recovery.mjs';
if(process.argv.includes('--admission-only'))await runAdmissionRegression('lifecycle');else{
const h=await createHarness();
const labels={en:{issue:'Issue to recorded contractor',start:'Start work',complete:'Record completion',verify:'Verify completion',observe:'Observe current work order'},ro:{issue:'Emite către furnizorul înregistrat',start:'Începe lucrul',complete:'Înregistrează finalizarea',verify:'Verifică finalizarea',observe:'Consultă ordinul curent'},fa:{issue:'صدور به پیمانکار ثبت‌شده',start:'شروع کار',complete:'ثبت نتیجهٔ کار',verify:'تأیید نتیجه',observe:'مشاهدهٔ دستورکار فعلی'}};
const formFor=text=>h.button(text)?.closest('form');
const mutationCalls=()=>h.calls.filter(c=>c.kind==='mutation');
try{
 // Existing lifecycle regression: all four actions, required checklist, zero cost,
 // three locales, terminal state, denied/lost request. Now uses real readbacks.
 for(const lang of ['en','ro','fa']){
  const t=labels[lang];await h.reset('draft');await h.renderLifecycle({lang});
  await h.submit(formFor(t.issue));h.eq(mutationCalls().at(-1).url,'/api/customer/v1/operations/commands');h.eq(mutationCalls().at(-1).body,{context_id:CTX});h.eq(h.changes.pop(),'assigned');
  await h.submit(formFor(t.start));h.eq(h.changes.pop(),'in_progress');
  h.eq(h.button(t.complete).disabled,true,'required checklist blocks completion');
  const checkForm=[...document.querySelectorAll('form')].find(f=>f!==formFor(t.complete));await h.change(checkForm.querySelector('textarea'),'Synthetic checklist evidence');await h.submit(checkForm);
  h.eq(h.button(t.complete).disabled,false);
  const complete=formFor(t.complete);await h.change(complete.querySelector('textarea'),'Synthetic completion only');await h.change(complete.querySelector('input'),'0');await h.submit(complete);
  h.eq(mutationCalls().at(-1).body.actual_cost,0);h.eq(h.changes.pop(),'completed');
  await h.change(formFor(t.verify).querySelector('textarea'),'Synthetic verification only');await h.submit(formFor(t.verify));h.eq(h.changes.pop(),'verified');h.eq(document.querySelector('form'),null,'verified is terminal, not payment/close');
  h.eq(mutationCalls().map(c=>c.action),['issue','start','complete','verify']);h.ok(document.body.textContent.includes(lang==='fa'?'فاکتور':lang==='ro'?'factură':'invoice'));
 }
 // Complete cannot race a newly started checklist write even before a render.
 await h.reset('in_progress');await h.renderLifecycle();const cf=document.querySelector('form'),complete=formFor(labels.en.complete);await h.change(cf.querySelector('textarea'),'A synchronous checklist fence');await h.change(complete.querySelector('textarea'),'No premature completion');
 const checkWait=defer();h.handlers.checklistPost=async()=>checkWait.promise;
 await h.act(async()=>{cf.dispatchEvent(new h.dom.window.Event('submit',{bubbles:true,cancelable:true}));complete.dispatchEvent(new h.dom.window.Event('submit',{bubbles:true,cancelable:true}));});h.eq(mutationCalls().length,0);await h.act(async()=>checkWait.reject(Error('unknown check')));h.eq(h.button(labels.en.complete).disabled,true);
 // Explicit button ownership is synchronous, not dependent on React busy state.
 await h.reset('draft');await h.renderLifecycle();const first=defer();h.handlers.mutation=async()=>first.promise;
 await h.act(async()=>{const f=formFor(labels.en.issue);f.dispatchEvent(new h.dom.window.Event('submit',{bubbles:true,cancelable:true}));f.dispatchEvent(new h.dom.window.Event('submit',{bubbles:true,cancelable:true}));});h.eq(mutationCalls().length,1);await h.act(async()=>first.reject(Error('lost response')));h.eq(h.changes.length,0);h.ok(document.body.textContent.includes('unknown'));
 await h.click(h.button(labels.en.observe));h.eq(h.button(labels.en.issue).disabled,true,'observation does not resolve the prior unknown command');h.eq(mutationCalls().length,1);
 for(const code of [400,401,403,408,409,429,500,503]){
  await h.reset('draft');await h.renderLifecycle();h.handlers.mutation=async()=>response({},code);await h.submit(formFor(labels.en.issue));h.eq(h.changes.length,0);h.eq(mutationCalls().length,1);h.eq(formFor(labels.en.start),undefined);
  await h.click(h.button(labels.en.observe));h.eq(mutationCalls().length,1,'refresh is read-only');if(code>=500||code===401||code===403||code===408||code===429)h.eq(h.button(labels.en.issue).disabled,true);
 }
 for(const action of ['issue','start','complete','verify'])for(const fault of ['empty','partial','wrong-id','wrong-status','wrong-type','json','timeout','read403','read500','readMalformed','readMissing','readWrongContext','readChanged',...(action==='issue'?[]:['readWrongEvent']),...(action==='complete'?['readWrongNotes']:[])]){
  const status={issue:'draft',start:'assigned',complete:'in_progress',verify:'completed'}[action];await h.reset(status);h.items[0]={...h.items[0],completed:true,completed_at:TIME,notes:'Earlier authorized check'};await h.renderLifecycle();
  const f=formFor(labels.en[action]);if(f.querySelector('textarea'))await h.change(f.querySelector('textarea'),'Retained original notes');if(f.querySelector('input'))await h.change(f.querySelector('input'),'0');
  h.handlers.mutation=async(c,next)=>{
   if(fault==='timeout')throw Error('synthetic timeout');if(fault==='empty')return response(null);if(fault==='partial')return response({id:ID,status:{issue:'assigned',start:'in_progress',complete:'completed',verify:'verified'}[action]});
   if(fault==='json')return {ok:true,status:200,json:async()=>{throw Error('partial JSON');}};
   const r=await next(),v=await r.json();if(fault==='wrong-id')v.id=OTHER;if(fault==='wrong-status')v.status='verified';if(fault==='wrong-status'&&action==='verify')v.status='completed';if(fault==='wrong-type')v.id=74;
   if(fault.startsWith('read'))h.handlers.read=async call=>{
    if(fault==='read403'||fault==='read500')return response({},fault==='read403'?403:500);if(fault==='readMalformed')return response({rows:[]});const p=h.payload(call.url);
    if(fault==='readMissing'){p.rows=[];p.detail=null;p.total=0;}if(fault==='readWrongContext')p.context.id=CTX2;if(fault==='readWrongEvent'){p.rows[0][action==='start'?'started_at':action==='complete'?'completed_at':'verified_at']='2026-10-26T10:01:00Z';}if(fault==='readWrongNotes')p.rows[0].completion_summary='Another command result';if(fault==='readChanged'){p.rows[0]={...p.rows[0],status:'cancelled'};p.detail=p.rows[0];}return response(p);
   };
   return response(v);
  };
  await h.submit(f);h.eq(h.changes.length,0,`${action}/${fault} never calls onChanged`);h.eq(document.body.textContent.includes('Request outcome is unknown'),!fault.startsWith('read'),`${action}/${fault}: a known command reply and a failed current observation remain distinct`);h.eq(mutationCalls().length,1);h.eq(document.querySelector('form'),null);
  if(action==='complete'||action==='verify'){h.handlers.read=undefined;await h.click(h.button(labels.en.observe));if(action==='verify'&&fault.startsWith('read')){h.eq(document.querySelector('form'),null,'known verified outcome and fresh terminal observation do not reopen a mutation');h.eq(mutationCalls()[0].intent.input.verification_notes,'Retained original notes');}else h.eq(document.querySelector('textarea')?.value,'Retained original notes',`${action}/${fault}: original input remains on an unsettled observation`);}
 }
 // An expired deadline cannot be rescued by a transport that returns a late
 // valid response after the server may already have committed.
 await h.reset('draft');await h.renderLifecycle();
 {
  const deadline=new AbortController(),originalTimeout=AbortSignal.timeout,late=defer();let result;
  try{AbortSignal.timeout=()=>deadline.signal;h.handlers.mutation=async(c,next)=>{result=await next();return late.promise;};await h.submit(formFor(labels.en.issue));const reads=h.calls.filter(c=>c.kind==='read').length;deadline.abort(Error('test deadline'));await h.act(async()=>late.resolve(result));h.eq(h.changes.length,0);h.eq(h.calls.filter(c=>c.kind==='read').length,reads,'expired response does not launch readback');h.ok(document.body.textContent.includes('unknown'));}
  finally{AbortSignal.timeout=originalTimeout;}
 }
 // Initial/current GET boundaries are validated independently of POST status.
 for(const fault of ['null','partial','id','status','type','summary','context','view','detail','duplicate']){
  await h.reset('draft');h.handlers.read=async c=>{const p=h.payload(c.url);if(fault==='null')return response(null);if(fault==='partial')return response({rows:[]});if(fault==='id')p.rows[0].id=OTHER;if(fault==='status')p.rows[0].status='paid';if(fault==='type')p.total='1';if(fault==='summary')p.summary.assets='0';if(fault==='context')p.context.id=CTX2;if(fault==='view')p.view='costs';if(fault==='detail')p.detail.status='verified';if(fault==='duplicate'){p.rows.push(p.rows[0]);p.total=2;}return response(p);};
  await h.renderLifecycle();h.eq(document.querySelector('form'),null);h.eq(mutationCalls().length,0);
 }
 // Frozen body/intent, and same-instance changes including callback replacement.
 for(const phase of ['network','json','readback'])for(const loss of ['context','work-order','status','loading','locale','callback','unmount']){
  await h.reset('completed');await h.renderLifecycle();await h.change(document.querySelector('textarea'),'Frozen verification intent');const old=defer();
  h.handlers.mutation=async(c,next)=>{if(phase==='network')return old.promise;if(phase==='json')return {ok:true,status:200,json:async()=>old.promise};const result=await next();h.handlers.read=async()=>old.promise;return result;};
  await h.submit(formFor(labels.en.verify));const request=mutationCalls()[0],replacement=[];h.handlers.read=undefined;
  if(loss==='unmount')await h.render(h.React.createElement('div'));else await h.renderLifecycle(loss==='context'?{contextId:CTX2}:loss==='work-order'?{workOrderId:OTHER}:loss==='status'?{status:'verified'}:loss==='loading'?{ready:false}:loss==='locale'?{lang:'ro'}:{onChanged:s=>replacement.push(s)});
  await h.act(async()=>old.resolve(phase==='json'?{id:ID,status:'verified',verified_at:TIME}:phase==='network'?response({id:ID,status:'verified',verified_at:TIME}):response(h.payload(`/api/customer/v1/maintenance?context_id=${CTX}&view=work_orders&id=${ID}&limit=1&offset=0`))));
  h.eq(h.changes.length,0);h.eq(replacement.length,0);h.eq(request.body.verification_notes,'Frozen verification intent');h.eq(request.channel,'FAKE_CANONICAL_COMMAND_PORT');h.eq(request.intent.context_id,CTX,'old canonical intent stays bound to its original Context');
 }
 // Old finally cannot clear the new scope's mutation slot.
 await h.reset('draft');await h.renderLifecycle();const old=defer(),fresh=defer();let sent=0;h.handlers.mutation=async()=>++sent===1?old.promise:fresh.promise;
 await h.submit(formFor(labels.en.issue));await h.renderLifecycle({workOrderId:OTHER,status:'assigned'});await h.submit(formFor(labels.en.start));await h.act(async()=>old.reject(Error('old failed')));await h.submit(formFor(labels.en.start));h.eq(mutationCalls().length,2);h.eq(h.button(labels.en.start).disabled,true);await h.act(async()=>fresh.reject(Error('unknown new')));
 console.log('SECTION: Actual Dashboard keeps');
 // Actual Dashboard keeps the selected identity across refreshed row objects.
 await h.reset('draft');await h.renderDashboard();await h.click(h.button('Details'));await h.submit(formFor(labels.en.issue));await h.flush(230);h.ok(document.querySelector('[role="dialog"]'));h.ok(formFor(labels.en.start),'fresh parent row retains selected WO by ID');
 await h.submit(formFor(labels.en.start));await h.flush(230);const check=document.querySelector('[role="dialog"] form');await h.change(check.querySelector('textarea'),'Integrated checklist evidence');await h.submit(check);
 await h.change(formFor(labels.en.complete).querySelector('textarea'),'Integrated completion');await h.change(formFor(labels.en.complete).querySelector('input'),'0');await h.submit(formFor(labels.en.complete));await h.flush(230);await h.change(formFor(labels.en.verify).querySelector('textarea'),'Integrated independent verification');await h.submit(formFor(labels.en.verify));await h.flush(230);
 h.eq(mutationCalls().map(c=>c.action),['issue','start','complete','verify']);h.eq(document.querySelector('[role="dialog"] form'),null);h.eq(h.rows.get(ID).status,'verified');
 // Child read denial/invalid mutation invalidates private parent details as
 // availability loss, never as a successful onChanged status callback.
 for(const outcome of ['read403','malformed',401,403,503]){
  await h.reset('draft');await h.renderDashboard();await h.click(h.button('Details'));
  h.handlers.mutation=async(c,next)=>{if(typeof outcome==='number')return response({},outcome);if(outcome==='malformed')return response({id:ID});const result=await next();h.handlers.read=async()=>response({},403);return result;};
  await h.submit(formFor(labels.en.issue));h.eq(document.querySelector('[role="dialog"] > div > dl'),null,'failed child authorization/readback hides parent private row');h.eq(formFor(labels.en.start),undefined);
 }
 console.log('SECTION: Preserve the same mounted');
 // Preserve the same mounted checklist's uncertain snapshot across parent
 // loading and fresh row replacement. A fresh observation is not write proof.
 await h.reset('in_progress');await h.renderDashboard();await h.click(h.button('Details'));const checklistWrite=defer();let checkResult;
 h.handlers.checklistPost=async(c,next)=>{checkResult=await next();return checklistWrite.promise;};const pendingChecklist=document.querySelector('[role="dialog"] form');await h.change(pendingChecklist.querySelector('textarea'),'Retained asynchronous checklist evidence');await h.submit(pendingChecklist);
 h.context={...h.context,loading:true};await h.renderDashboard();h.eq(document.querySelector('[role="dialog"] > div > dl'),null);
 h.context={...h.context,loading:false};await h.renderDashboard();h.eq(h.button(labels.en.complete).disabled,true,'unknown checklist survives parent readiness epoch');
 await h.act(async()=>checklistWrite.resolve(checkResult));h.eq(h.button(labels.en.complete).disabled,true);await h.submit(formFor(labels.en.complete));h.eq(mutationCalls().length,0);h.eq(h.writes().length,1);h.ok(document.body.textContent.includes('Retained asynchronous checklist evidence'));
 console.log('SECTION: Close/reopen is');
 // Close/reopen is a new owner, not an original-request proof or durable recovery.
 await h.reset('draft');await h.renderDashboard();await h.click(h.button('Details'));const oldClose=defer(),newOpen=defer();let dispatched=0;h.handlers.mutation=async()=>++dispatched===1?oldClose.promise:newOpen.promise;
 await h.submit(formFor(labels.en.issue));await h.click(h.button('Close'));await h.click(h.button('Details'));await h.submit(formFor(labels.en.issue));const reads=h.calls.filter(c=>c.kind==='read').length;
 await h.act(async()=>oldClose.resolve(response({id:ID,status:'assigned',vendor_id:VENDOR})));h.eq(h.calls.filter(c=>c.kind==='read').length,reads,'old callback cannot refresh reopened selection');await h.submit(formFor(labels.en.issue));h.eq(mutationCalls().length,2);await h.act(async()=>newOpen.reject(Error('unknown reopened write')));
 console.log('SECTION: Parent loading/denial');
 // Parent loading/denial must hide stale private row and fence a pending child.
 for(const mode of ['loading','denied','missing','malformed','refresh']){console.log('PARENT_MODE '+mode);
  await h.reset('draft');await h.renderDashboard();await h.click(h.button('Details'));const wait=defer();h.handlers.mutation=async()=>wait.promise;await h.submit(formFor(labels.en.issue));
  if(mode==='loading'){h.context={...h.context,loading:true};await h.renderDashboard();}else{h.handlers.read=async c=>{if(new URL(c.url,'https://cladora.test').searchParams.get('id'))return h.model(c);if(mode==='refresh')return h.model(c);if(mode==='denied')return response({},403);if(mode==='malformed')return response({rows:[]});const p=h.payload(c.url);p.rows=[];p.total=0;return response(p);};await h.click(h.button('Refresh'));await h.flush(230);}
  await h.act(async()=>wait.resolve(response({id:ID,status:'assigned',vendor_id:VENDOR})));h.eq(formFor(labels.en.start),undefined);if(mode!=='refresh')h.eq(document.querySelector('[role="dialog"] > div > dl'),null);else h.eq(h.button(labels.en.issue).disabled,true,'parent refresh does not resolve pending write');h.eq(mutationCalls().length,1);
 }
 console.log('SECTION: Out-of-order Dashboard');
 // Out-of-order Dashboard reads cannot replace a newer authorized page, even
 // when loading returns to the exact same Context and query tuple.
 for(const loss of ['context','same-tuple-loading','locale']){
  await h.reset('draft');const stale=defer();let reads=0;h.handlers.read=async(c,next)=>++reads===1?stale.promise:next();await h.renderDashboard();
  const oldPayload=h.payload(h.calls[0].url);oldPayload.rows=oldPayload.rows.map(r=>({...r,title:'OLD PRIVATE RECORD'}));
  if(loss==='context')h.context={...h.context,dashboard:{contextId:CTX2},active:{...h.context.active,context_id:CTX2}};
  if(loss==='same-tuple-loading'){h.context={...h.context,loading:true};await h.renderDashboard();h.context={...h.context,loading:false};}
  h.rows.set(ID,{...h.rows.get(ID),title:'New accepted record'});await h.renderDashboard(loss==='locale'?{lang:'ro'}:{});
  h.ok(document.body.textContent.includes('New accepted record'));await h.act(async()=>stale.resolve(response(oldPayload)));h.ok(document.body.textContent.includes('New accepted record'));h.eq(document.body.textContent.includes('OLD PRIVATE RECORD'),false);h.eq(mutationCalls().length,0);
 }
 console.log('SECTION: Commit-before-passive');
 // Commit-before-passive cleanup: real React ordering, no replacement hooks.
 await h.reset('draft');const late=defer(),trace=[];h.handlers.read=async()=>late.promise.then(v=>{trace.push('old-read-continuation');return v;});
 const Frame=({ready,phase,onLayout})=>{h.React.useLayoutEffect(()=>{if(phase)onLayout();},[phase,onLayout]);h.React.useEffect(()=>{if(phase)trace.push('parent-passive');},[phase]);return h.React.createElement(h.WorkOrderLifecyclePanel,{contextId:CTX,workOrderId:ID,status:'draft',lang:'en',onChanged:h.changed,ready});};
 await h.render(h.React.createElement(Frame,{ready:true,phase:0}));const request=h.calls[0],actMode=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=false;
 try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('layout not reached')),1000);h.root.render(h.React.createElement(Frame,{ready:false,phase:1,onLayout:()=>{trace.push('ready-loss-committed');h.eq(request.options.signal.aborted,true);const end=performance.now()+25;while(performance.now()<end){/* bounded test-only layout work, no product hook */}late.resolve(response(h.payload(`/api/customer/v1/maintenance?context_id=${CTX}&view=work_orders&id=${ID}&limit=1&offset=0`)));let drain=Promise.resolve();for(let i=0;i<20;i++)drain=drain.then(()=>undefined);void drain.then(()=>{trace.push('before-passive-checkpoint');clearTimeout(timeout);resolve();},reject);}}));});
  h.ok(trace.includes('old-read-continuation'));h.eq(trace.includes('parent-passive'),false,'late continuation observed before passive phase');h.eq(document.querySelector('form'),null);h.eq(h.changes.length,0);
 }finally{globalThis.IS_REACT_ACT_ENVIRONMENT=actMode;}
 await h.flush();h.ok(trace.includes('parent-passive'),'later passive phase was actually observed');console.log('COMMIT_GAP_ORDER '+JSON.stringify(trace));
 console.log(JSON.stringify({suite:'work-order-lifecycle-and-dashboard',assertions:h.checks,result:'PASS',boundary:'actual mounted Dashboard/Lifecycle/Checklist; controlled fake command-result port and reads; canonical gate tested separately',SQL_Auth_HTTP_runtime:'NOT_RUN'}));
}finally{await h.close();}
await runAdmissionRegression('lifecycle');
}
