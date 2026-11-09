/** TypeScript-derived owner inventory expansion only. No SQL parser/execution. */
import{execFileSync}from'node:child_process';import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
const CE='989e35a78363908357f65460011492e0472dc047',read=p=>execFileSync('git',['show',CE+':'+p],{encoding:'utf8'}),sha=s=>createHash('sha256').update(s).digest('hex');
const packet=JSON.parse(read('supabase/install/ce010-announcement-v1/packet.json')),queries=[];
for(const q of packet.queries){
 if(q.sql?.includes('jurisdiction_domain_artifact_receipt_evidence')||q.sql?.startsWith('select pg_backend_pid() as backend_pid,txid_current()'))continue;
 let sql=q.sql;if(!sql){sql=q.source.slice(1,-1).replace("${replayOnly ? 'for share' : 'for update'}",'for update');if(sql.includes('${'))throw Error('UNMAPPED_DYNAMIC_CE010_SQL');}
 if(!queries.some(x=>x.sql===sql))queries.push({sql,sha256:sha(sql),source_path:q.path,source_symbol:q.symbol,parameters:Math.max(0,...[...sql.matchAll(/\$(\d+)/g)].map(m=>Number(m[1])))});
}
for(const p of ['src/lib/core/postgres-transaction-host-v1.ts','src/lib/core/current-authority-postgres-provider-v1.ts']){
 // Host deltas since CE snapshot may add independent closed families, but every
 // admitted literal must still occur in the actual Core source (dynamic workspace separately).
 const text=readFileSync(p,'utf8');for(const q of queries.filter(q=>q.source_path===p&&!q.source_symbol.startsWith('dynamic_')))if(!text.includes(q.sql))throw Error('CORE_QUERY_SOURCE_DRIFT:'+q.source_symbol);
}
const value={contract:'core-ce010-query-profile.v1',consumer:CE,module:'community_basic',entitlement:'module.community_basic',read_permission:'community.community.read',command_permission:'community.announcement.publish',command_purpose:'community.announcement.command',queries};
writeFileSync('src/lib/core/ce010-query-profile-v1.json',JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify({closed_queries:queries.length,dynamic_expansions:1,artifact_or_terminal_admitted:false,SQL_executed:false}));
