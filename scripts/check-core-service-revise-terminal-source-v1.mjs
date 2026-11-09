/** Offline exact-source check; TS literal inventory only, never SQL parse/compile/execute. */
import{readFileSync}from'node:fs';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import{resolve,dirname}from'node:path';import{fileURLToPath}from'node:url';import ts from'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),read=p=>readFileSync(resolve(root,p));
const review=JSON.parse(read('docs/core/domain-ports-01/service-revise-terminal-26/source-review.json'));
const profile=JSON.parse(read('src/lib/core/service-revise-query-profile-v1.json'));
const sha=b=>createHash('sha256').update(b).digest('hex'),blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');
const git=(ref,p)=>execFileSync('git',['show',ref+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']});
for(const p of review.effective_source_pins){const b=git(p.ref,p.path);if(b.length!==p.bytes||sha(b)!==p.sha256||blob(b)!==p.git_blob)throw Error('EFFECTIVE_SOURCE_PIN_MISMATCH:'+p.path);}
const sql=git(review.effective_SERVICE.FullSHA,'supabase/proposals/service-offering-revise-writer-v1/install.sql');
for(const p of review.function_definitions){const b=sql.subarray(p.start_byte,p.end_byte);if(b.length!==p.bytes||sha(b)!==p.sha256||blob(b)!==p.git_blob||!b.toString().startsWith(p.start))throw Error('FUNCTION_BODY_PIN_MISMATCH:'+p.signature);}
const literals=new Set();
for(const p of profile.sourcePins){const b=git(p.ref,p.path);if(b.length!==p.bytes||sha(b)!==p.sha256)throw Error('QUERY_ROOT_PIN_MISMATCH');const f=ts.createSourceFile(p.path,b.toString(),ts.ScriptTarget.Latest,true);const walk=n=>{if(ts.isStringLiteralLike(n)&&/^\s*(select|with|insert|update|delete)\b/i.test(n.text))literals.add(n.text);ts.forEachChild(n,walk);};walk(f);}
if(literals.size!==profile.queries.length||!profile.queries.every(q=>literals.has(q.sql)&&sha(q.sql)===q.sha256&&q.arguments.length===q.parameters))throw Error('QUERY_INVENTORY_MISMATCH');
const parent='742d3ef9203c8135b56e45a941a3f664f09f097e',hostPath='src/lib/core/postgres-transaction-host-v1.ts',before=git(parent,hostPath).toString(),after=read(hostPath).toString();
for(const [a,b]of[['class TerminalAttemptV1','export type CoreCe012ReplayOnlyResultV1'],['          const sealResponse = async function','          const settledResponse = function']]){if(before.slice(before.indexOf(a),before.indexOf(b))!==after.slice(after.indexOf(a),after.indexOf(b)))throw Error('ACCEPTED_CE_TERMINAL_BODY_CHANGED');}
for(const p of['src/lib/core/service-revise-admission-candidate-v1.ts','src/lib/core/service-offering-revise-source-port-v1.ts','src/lib/core/service-offering-revision-source-v1.ts','src/lib/core/service-s01/provider-agreement-reader-v1.ts','docs/core/domain-ports-01/ce010-producer-19/profile-contract.json'])if(!read(p).equals(git(parent,p)))throw Error('PROTECTED_SOURCE_CHANGED:'+p);
console.log(JSON.stringify({effective_SERVICE:review.effective_SERVICE.FullSHA,source_files:review.effective_source_pins.length,whole_function_bodies:review.function_definitions.length,scope_queries:literals.size,CE_terminal_bodies:'BYTE_IDENTICAL',Core24_25_S01_policy:'BYTE_IDENTICAL',permit:null,runtime:null,SQL_parser:false,native:'NOT_RUN_NOT_PASS'}));
