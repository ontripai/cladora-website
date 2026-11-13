import { z } from 'zod';
import { ce010CommandSchema, type Ce010Command } from './community-base-schema.ts';
import {announcementExecutionWireV1} from './community-announcement-protocol-v1';
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const resultSchema = z.strictObject({ entity_type: z.enum(['community','community_announcement','community_content_report']), entity_id: uuid,
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), command: z.enum(['create_community','create_announcement','publish_announcement','cancel_announcement','report_content','decide_content_report']), replayed: z.boolean() });
export function parseCommunityCommandResult(value: unknown, command: Ce010Command) {
  const result = resultSchema.parse(value);
  const entity = command.type === 'create_community' ? 'community' : ['report_content','decide_content_report'].includes(command.type) ? 'community_content_report' : 'community_announcement';
  const id = command.type === 'create_community' ? command.community_id : 'announcement_id' in command ? command.announcement_id : 'report_id' in command ? command.report_id : '';
  const version = ['create_community','create_announcement','report_content'].includes(command.type) ? 1 : command.expected_version + 1;
  if (result.command !== command.type || result.entity_type !== entity || result.entity_id.toLowerCase() !== id.toLowerCase() || result.version !== version) throw Error('invalid_community_result');
  return result;
}
export type CommunityExecution = { phase: 'ready'|'sending'|'unknown'|'rejected'|'done'; pending: Readonly<{command:Ce010Command;wire:string}>|null; notReady?:boolean };
function freeze(value: unknown): void { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } }
// Narrow CE010 transport adapter. No store, authority, receipt lookup or durable engine.
export function createCommunityCommandSession(options: {contextId:string;workspaceId:string;communityId:string;owner:()=>object|null;fetch:typeof fetch;changed:()=>void;denied:()=>void;timeoutMs?:number;announcementProtocol?:()=>boolean}) {
  let state:CommunityExecution={phase:'ready',pending:null}; let flight:{cancel:()=>void}|null=null;let uncertain=false;
  let native=false,prepared=false;
  async function dispatch() {
    const owner=options.owner();let pending=state.pending;
    if (!owner || !pending || flight) return false;
    const controller=new AbortController();let cancel!:()=>void;
    const cancelled=new Promise<never>((_,reject)=>{cancel=()=>{controller.abort();reject(Error('cancelled'));};});
    const operation={cancel};flight=operation;const timer=setTimeout(cancel,options.timeoutMs??15000);
    const current=()=>options.owner()===owner && state.pending===pending && !controller.signal.aborted;
    state={...state,phase:'sending',notReady:false};options.changed();
    try {
      if(native&&!prepared){
        const preparation=await Promise.race([options.fetch('/api/customer/v1/community/base',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'prepare_announcement',command:pending.command}),signal:controller.signal}),cancelled]);
        if(!current())throw Error('old_preparation');
        if(!preparation.ok){state={...state,phase:uncertain?'unknown':'rejected',notReady:preparation.status===503};options.changed();if([401,403,404].includes(preparation.status))options.denied();return false;}
        const body=await Promise.race([preparation.json(),cancelled]);if(!current())throw Error('old_preparation_decode');
        pending=Object.freeze({...pending,wire:announcementExecutionWireV1(body,pending.command)});state={...state,pending};prepared=true;
      }
      const response=await Promise.race([options.fetch('/api/customer/v1/community/base',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:pending.wire,signal:controller.signal}),cancelled]);
      if (!current()) throw Error('old_owner');
      if (!response.ok) {
        uncertain=uncertain || response.status>=500 || [408,429].includes(response.status);
        state={...state,phase:uncertain?'unknown':'rejected',notReady:response.status===503};options.changed();
        if ([401,403,404].includes(response.status)) options.denied();return false;
      }
      const value=await Promise.race([response.json(),cancelled]);if(!current())throw Error('old_decode');
      parseCommunityCommandResult(value,pending.command);
      state={phase:'done',pending:null};uncertain=false;options.changed();return true;
    } catch {
      // An abandoned request still belongs to its old slot, never the new scope.
      uncertain=true;state={...state,phase:'unknown',pending};if(options.owner()===owner)options.changed();return false;
    } finally {clearTimeout(timer);if(flight===operation)flight=null;}
  }
  return {getState:()=>state,
    send(input:unknown) {
      if (state.pending || flight || !options.owner()) return Promise.resolve(false);
      const command=ce010CommandSchema.parse(input);
      if(command.context_id!==options.contextId||command.workspace_id!==options.workspaceId||command.community_id!==options.communityId)return Promise.resolve(false);
      const snapshot=JSON.parse(JSON.stringify(command)) as Ce010Command;freeze(snapshot);
      native=options.announcementProtocol?.()===true&&['create_announcement','publish_announcement','cancel_announcement'].includes(command.type);prepared=false;
      state={phase:'ready',pending:Object.freeze({command:snapshot,wire:JSON.stringify(snapshot)})};return dispatch();
    },replay:()=>state.phase==='unknown'?dispatch():Promise.resolve(false),
    resetRejected(){if(flight||!options.owner()||state.phase!=='rejected'||uncertain)return false;state={phase:'ready',pending:null};options.changed();return true;},
    invalidate(){flight?.cancel();},
  };
}
