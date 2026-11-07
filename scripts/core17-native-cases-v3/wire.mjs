/** Actual pg protocol observations. Never infer settlement from HTTP/status. */
import assert from 'node:assert/strict';
import {SQL,normalizeSQL} from './queries.mjs';
export function traceClient(client,evidence,{fault=false}={}){
 const trace={pid:null,events:[],queries:[],codes:[],fault_fired:false,locks:[],stages:new Set()};evidence.push(trace);
 client.connection.on('commandComplete',m=>trace.events.push({type:'CommandComplete',tag:m.text,pid:client.processID}));
 client.connection.on('readyForQuery',m=>trace.events.push({type:'ReadyForQuery',status:m.status,pid:client.processID}));
 client.connection.on('errorMessage',m=>trace.codes.push(m.code));
 const raw=client.query.bind(client);
 client.query=async(text,values=[])=>{
  assert.equal(typeof text,'string','CLOSED_TEXT_QUERY_REQUIRED');trace.pid=client.processID;const normal=normalizeSQL(text);trace.queries.push(normal);if(normal===normalizeSQL(SQL.keyBarrier)){assert.equal(typeof values[0],'string');trace.locks.push(values[0]);}
  trace.pending_query=normal;
  try{const result=await raw(text,values);
  if(normal.startsWith('insert into platform.idempotency_keys'))trace.stages.add('reservation');
  if(normal.startsWith('select app_private.apply_service_v14_execution_v1('))trace.stages.add('mutation');
  if(normal.startsWith('insert into audit.events'))trace.stages.add('audit');
  if(normal.startsWith('insert into platform.outbox_events'))trace.stages.add('outbox');
  if(fault&&normal===normalizeSQL(SQL.receiptUpdate)){
   assert.equal(trace.fault_fired,false,'FAULT_ONCE_PER_ATTEMPT');assert.deepEqual([...trace.stages].sort(),['audit','mutation','outbox','reservation']);trace.fault_fired=true;
   // Real PG division-by-zero aborts this SAME transaction after real effects
   // were staged. No fake JS SQLSTATE, trigger, ACL or provider modification.
   await raw(SQL.precommitFault,[0]);assert.fail('REAL_PRECOMMIT_FAULT_DID_NOT_FIRE');
  }
  return result;
  }finally{trace.pending_query=null;}
 };
 return trace;
}
export function terminal(trace,tag,since=0){
 for(let i=trace.events.length-1;i>=since;i--)if(trace.events[i].type==='CommandComplete'&&trace.events[i].tag===tag){
  const end=trace.events.slice(i+1).find(e=>e.type==='ReadyForQuery');if(end?.status==='I'&&end.pid===trace.events[i].pid&&end.pid===trace.pid&&Number.isInteger(end.pid)&&end.pid>0)return{pid:end.pid,command:tag,ready:'I'};
 }throw Error('SAME_PID_TERMINAL_ACK_NOT_OBSERVED');
}
export function normalizeEvidence(traces){return traces.map(t=>({...t,stages:[...t.stages]}));}
const failures=new WeakMap();
export function operatorFailure(error){return error&&typeof error==='object'?failures.get(error)??null:null;}
export function noteCleanup(first,cleanup){if(first&&typeof first==='object')failures.set(first,{...failures.get(first),cleanup_error_code:cleanup?.code??cleanup?.name??'UNKNOWN',settlement:'UNKNOWN'});}
export async function transaction(c,trace,body,{rollback=false,readOnly=false,beforeCommit}={}){
 const since=trace.events.length;let attemptingCommit=false;
 try{await c.query(readOnly?'begin isolation level repeatable read read only':'begin');await c.query('set local search_path=pg_catalog');await c.query("set local lock_timeout='5s'");await c.query("set local statement_timeout='10s'");
  const result=await body();if(beforeCommit)await beforeCommit(result);attemptingCommit=!rollback;const tag=rollback?'ROLLBACK':'COMMIT',r=await c.query(tag.toLowerCase());assert.equal(r.command,tag);terminal(trace,tag,since);return result;
 }catch(error){
  let settlement='UNKNOWN';
  if(!attemptingCommit)try{await c.query('rollback');terminal(trace,'ROLLBACK',since);settlement='ROLLBACK_ACK_RFQ_I';}catch{}
  if(error&&typeof error==='object')failures.set(error,{settlement,commit_attempted:attemptingCommit});
  throw error;
 }
}
