/** Offline-only fixed source composer: no env, credentials, connection or SQL execution. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
export const DOCS_CUSTODY_UNIT_DIR='supabase/install/documents-upload-custody-v1';
export const read=n=>readFileSync(resolve(root,DOCS_CUSTODY_UNIT_DIR,n),'utf8');
export const sha=b=>createHash('sha256').update(b).digest('hex');
export function composeCoreDocumentsCustodyV1(){
 const install=read('install.sql'),checks=[];
 for(const m of install.matchAll(/CREATE FUNCTION ([a-z_]+\.[a-z_0-9]+)\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS \$([a-z]+)\$([\s\S]*?)\$\3\$;/g)){
  const signature=m[1]+(m[1].startsWith('platform_dev.')?'(text,jsonb)':'()');
  checks.push(`IF encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid='${signature}'::regprocedure),'UTF8')),'hex') IS DISTINCT FROM '${sha(m[4])}' THEN RAISE EXCEPTION 'documents_custody_body_mismatch' USING ERRCODE='55000'; END IF;`);
 }
 if(checks.length!==2)throw Error('DOCUMENTS_CUSTODY_CLOSURE_INVALID');
 const verify=read('verify.sql').replace('-- CORE_DOCUMENTS_BODY_PINS',()=>checks.join('\n'));
 const head="BEGIN;\nSET LOCAL search_path=pg_catalog;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='30s';\n";
 return{sql:head+read('preflight.sql')+'\n'+install+'\n'+verify+'\nCOMMIT;\n',preflight:head.replace('BEGIN;','BEGIN READ ONLY;')+read('preflight.sql')+'\nROLLBACK;\n',verify:head.replace('BEGIN;','BEGIN READ ONLY;')+verify+'\nROLLBACK;\n'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=composeCoreDocumentsCustodyV1(),out=process.argv.find(x=>x.startsWith('--output='));
 if(out)writeFileSync(out.slice(9),result.sql,{flag:'wx',mode:0o600});
 console.log(JSON.stringify({contract:'core-documents-custody-install.v1',bytes:Buffer.byteLength(result.sql),sha256:sha(result.sql),executed:false,default_execute:false}));
}
