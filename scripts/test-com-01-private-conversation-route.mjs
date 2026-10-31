import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { z } from 'zod';

const require = createRequire(import.meta.url);
let auth = { data: { claims: { sub: 'actor' } }, error: null };
let result = { data: null, error: null };
let calls = [];
const uuid = z.string().uuid();
const commandSchema = z.strictObject({
  contract_version: z.literal('communications-private-conversation-workspace.v1'),
  context_id: uuid, workspace_id: uuid, conversation_id: uuid, unit_id: uuid,
  recipient_membership_id: uuid, initial_message_id: uuid,
  body: z.string().trim().min(1).max(5000), client_request_id: uuid,
  idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
});
const receiptSchema = z.strictObject({ contract_version: z.literal('communication-request-receipt.v1'), request_status: z.literal('accepted') }).passthrough();
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const filename = fileURLToPath(file); const mod = new Module(filename);
  mod.require = name => name === '@/lib/supabase/server' ? { createClient: async () => ({
    auth: { getClaims: async () => auth }, schema: schema => { assert.equal(schema, 'customer_api'); return {
      rpc: async (rpc, args) => { calls.push({ rpc, args }); return result; },
    }; },
  }) } : name === '@/lib/customer/communications-private-conversation-workspace-v1'
    ? { communicationsPrivateConversationWorkspaceV1Schema: commandSchema }
    : name === '@/lib/core/communication-request-receipt-v1'
      ? { communicationRequestReceiptV1Schema: receiptSchema }
      : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url)) : require(name);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, filename);
  cache.set(file.href, mod.exports); return mod.exports;
}

const { POST } = load(new URL('../src/app/api/customer/v1/private-conversations/route.ts', import.meta.url));
const { NextRequest } = require('next/server');
const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const command = { contract_version: 'communications-private-conversation-workspace.v1',
  context_id:id(1),workspace_id:id(2),conversation_id:id(3),unit_id:id(4),
  recipient_membership_id:id(5),initial_message_id:id(6),body:'Workspace message',
  client_request_id:id(7),idempotency_key:'com01-private-001' };
const receipt = { contract_version:'communication-request-receipt.v1', request_status:'accepted' };
const response = replayed => ({ conversation_id:id(3),message_id:id(6),replayed,communication_receipt:receipt });
const post = (body=command, headers={}, suffix='') => POST(new NextRequest(`https://cladora.test/api/customer/v1/private-conversations${suffix}`, {
  method:'POST',headers:{'content-type':'application/json',origin:'https://cladora.test',...headers},body:typeof body==='string'?body:JSON.stringify(body),
}));
async function check(name, run) { calls=[]; await run(); console.log(`PASS ${name}`); }

await check('new conversation delegates exact strict command and returns 201',async()=>{
  result={data:response(false),error:null};const r=await post();assert.equal(r.status,201);
  assert.deepEqual(calls,[{rpc:'create_private_conversation_v2',args:{p_request:command}}]);
  assert.equal((await r.json()).communication_receipt.request_status,'accepted');
});
await check('exact replay returns 200 without changing the command',async()=>{
  result={data:response(true),error:null};assert.equal((await post()).status,200);
  assert.deepEqual(calls[0].args.p_request,command);
});
for(const body of [{...command,tenant_id:id(9)},{...command,actor_id:id(9)},{...command,workspace_id:'bad'},{}])
  await check('injected or malformed command is rejected before RPC',async()=>{assert.equal((await post(body)).status,400);assert.equal(calls.length,0);});
await check('cross-origin mutation is denied before RPC',async()=>{assert.equal((await post(command,{origin:'https://evil.test'})).status,403);assert.equal(calls.length,0);});
await check('unauthenticated mutation is denied',async()=>{auth={data:null,error:null};assert.equal((await post()).status,401);assert.equal(calls.length,0);auth={data:{claims:{sub:'actor'}},error:null};});
for(const [code,status] of [['42501',403],['23505',409],['40001',409],['22023',400],['XX000',500]])
  await check(`database ${code} maps to bounded ${status}`,async()=>{result={data:null,error:{code,message:'private details'}};const r=await post();assert.equal(r.status,status);assert.doesNotMatch(JSON.stringify(await r.json()),/private details/);});
await check('malformed database receipt fails closed',async()=>{result={data:{conversation_id:id(3)},error:null};assert.equal((await post()).status,502);});

console.log('PASS COM01/#166 private-conversation API boundary');
