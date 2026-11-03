/** Reviewed source seam only. No environment flag, remote switch or activation. */
export const CHECKLIST_C03_CUTOVER:Readonly<{
 state:'inactive'|'active';protocol:2;scope:'technical_test_only';
 installed_source_seal:string|null;caller_acl_seal:string|null;legacy_inventory_seal:string|null;
 execution_authorization:string|null;
}>=Object.freeze({state:'inactive',protocol:2,scope:'technical_test_only',installed_source_seal:null,
 caller_acl_seal:null,legacy_inventory_seal:null,execution_authorization:null});
export function checklistCutoverMode():'legacy'|'v2'|'hold'{
 const c=CHECKLIST_C03_CUTOVER;
 const bindings=[c.installed_source_seal,c.caller_acl_seal,c.legacy_inventory_seal,c.execution_authorization];
 if(c.state==='inactive'&&c.protocol===2&&c.scope==='technical_test_only'&&bindings.every(v=>v===null))return 'legacy';
 if(c.state==='active'&&c.protocol===2&&c.scope==='technical_test_only'&&bindings.every(v=>typeof v==='string'&&/^sha256:[0-9a-f]{64}$/.test(v)))return 'v2';
 return 'hold'; // Partial/unknown cutover NEVER falls back to the old writer.
}
export const checklistV2Enabled=()=>checklistCutoverMode()==='v2';

/** Deny-only journal: no command key, receipt, authority, TTL or clear API.
 * v1 markers have no proven attempt owner and remain held without migration.
 * v2 entries are per-attempt and never removed: an exact known reply can mark
 * only its own inflight entry known. Overlapping admission may occur across
 * tabs; it cannot lose another entry or settle another POST. This is not CAS.
 */
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>&Partial<Pick<Storage,'key'|'length'>>;
type LegacyHold={version:1;kind:'legacy_keyless_checklist';context_id:string;work_order_id:string;state:'inflight'|'unknown'};
export type LegacyChecklistAttempt=Readonly<{attempt_id:string;context_id:string;work_order_id:string}>;
type Entry=LegacyChecklistAttempt&{version:2;kind:'legacy_keyless_checklist_attempt';state:'inflight'|'unknown'|'known'};
export const LEGACY_CHECKLIST_HOLD_KEY='cladora.operations.checklist.legacy-keyless.v1';
export const LEGACY_CHECKLIST_ATTEMPT_PREFIX=LEGACY_CHECKLIST_HOLD_KEY+'.attempt.v2:';
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
// Browser lifetime ownership only. A deserialized/copied handle has no ownership.
// These collections deny locally; neither authorizes any server operation.
const owners=new WeakMap<LegacyChecklistAttempt,Store>(),faulted=new WeakSet<Store>();
function oldHold(storage:Store):LegacyHold|null{
 const text=storage.getItem(LEGACY_CHECKLIST_HOLD_KEY);if(text===null)return null;
 const h=JSON.parse(text) as LegacyHold;
 if(!h||Object.keys(h).sort().join(',')!=='context_id,kind,state,version,work_order_id'
  ||h.version!==1||h.kind!=='legacy_keyless_checklist'||!uuid.test(h.context_id)||!uuid.test(h.work_order_id)
  ||!['inflight','unknown'].includes(h.state))throw Error('legacy_checklist_hold_invalid');
 return h;
}
function keyFor(a:LegacyChecklistAttempt){return LEGACY_CHECKLIST_ATTEMPT_PREFIX+a.attempt_id;}
function readEntry(storage:Store,key:string):Entry|null{
 const text=storage.getItem(key);if(text===null)return null;
 const e=JSON.parse(text) as Entry;
 if(!e||Object.keys(e).sort().join(',')!=='attempt_id,context_id,kind,state,version,work_order_id'
  ||e.version!==2||e.kind!=='legacy_keyless_checklist_attempt'||!uuid.test(e.attempt_id)
  ||!uuid.test(e.context_id)||!uuid.test(e.work_order_id)||key!==keyFor(e)
  ||!['inflight','unknown','known'].includes(e.state))throw Error('legacy_checklist_hold_invalid');
 return e;
}
function storeEntry(storage:Store,e:Entry){
 const bytes=JSON.stringify(e);storage.setItem(keyFor(e),bytes);
 if(storage.getItem(keyFor(e))!==bytes)throw Error('legacy_checklist_hold_unavailable');
}
export function hasLegacyChecklistHold(storage:Store){
 try{
  if(faulted.has(storage)||oldHold(storage)!==null)return true;
  const n=storage.length,key=storage.key;
  if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0||typeof key!=='function')throw Error('legacy_checklist_enumeration_unavailable');
  const seen=new Set<string>();
  for(let i=0;i<n;i++){
   const k=key.call(storage,i);if(k===null||seen.has(k))return true;seen.add(k);
   if(k.startsWith(LEGACY_CHECKLIST_ATTEMPT_PREFIX)){
    const e=readEntry(storage,k);if(!e||e.state!=='known')return true;
   }
  }
  // Our journal never deletes entries. Concurrent insertion/reordering cannot
  // be interpreted as an empty scan. No storage event is required for safety.
  if(storage.length!==n)return true;
  const order=Array.from(seen);for(let i=0;i<n;i++)if(key.call(storage,i)!==order[i])return true;
  return storage.length!==n;
 }catch{faulted.add(storage);return true;}
}
function ownedEntry(storage:Store,a:LegacyChecklistAttempt){
 if(!a||owners.get(a)!==storage)throw Error('legacy_checklist_attempt_owner');
 const e=readEntry(storage,keyFor(a));
 if(e&&(e.context_id!==a.context_id||e.work_order_id!==a.work_order_id))throw Error('legacy_checklist_hold_binding');
 return e;
}
export function beginLegacyChecklistAttempt(storage:Store,context_id:string,work_order_id:string):LegacyChecklistAttempt{
 if(!uuid.test(context_id)||!uuid.test(work_order_id)||hasLegacyChecklistHold(storage))throw Error('legacy_checklist_safe_hold');
 const a=Object.freeze({attempt_id:crypto.randomUUID(),context_id,work_order_id});
 try{
  if(storage.getItem(keyFor(a))!==null)throw Error('legacy_checklist_attempt_collision');
  storeEntry(storage,{...a,version:2,kind:'legacy_keyless_checklist_attempt',state:'inflight'});
  owners.set(a,storage);return a;
 }catch(error){faulted.add(storage);throw error;}
}
export function markLegacyChecklistUnknown(storage:Store,a:LegacyChecklistAttempt){
 try{
  const e=ownedEntry(storage,a);if(e?.state==='known')throw Error('legacy_checklist_attempt_already_known');
  // Recreate only this issued owner's UNKNOWN if its entry was externally lost.
  storeEntry(storage,{...a,version:2,kind:'legacy_keyless_checklist_attempt',state:'unknown'});
 }catch(error){faulted.add(storage);throw error;}
}
/** A complete reply and its validated observation belong only to this live
 * original attempt. UNKNOWN and ownerless v1 entries can NEVER become known. */
export function acknowledgeKnownLegacyReply(storage:Store,a:LegacyChecklistAttempt){
 try{
  const e=ownedEntry(storage,a);if(!e||e.state!=='inflight')throw Error('legacy_checklist_unknown_not_reconciled');
  storeEntry(storage,{...e,state:'known'}); // no removeItem, no receipt or success proof
 }catch(error){faulted.add(storage);throw error;}
}
