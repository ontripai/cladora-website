/** Local source reconstruction from fixed Git objects. No fetch/SQL/install. */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCe010AdmissionV2} from './lib/ce010-admission-packet-v2.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const args=process.argv.slice(2),out=args[0]?.startsWith('--output=')?args[0].slice(9):null;
if(args.length!==1||!out||!path.isAbsolute(out))throw Error('ONLY_ABSOLUTE_LOCAL_OUTPUT_ALLOWED_NO_INSTALL');
const packet=buildCe010AdmissionV2((ref,p)=>execFileSync('git',['show',ref+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']}));
const files={...packet.files,'packet.json':JSON.stringify(packet.manifest,null,2)+'\n'};
for(const[name,body]of Object.entries(files))if(existsSync(path.join(out,name))&&readFileSync(path.join(out,name),'utf8')!==body)throw Error('PRESERVE_EXISTING_OUTPUT_CONFLICT '+name);
mkdirSync(out,{recursive:true});for(const[name,body]of Object.entries(files))writeFileSync(path.join(out,name),body);
console.log(JSON.stringify({status:packet.manifest.status,files:Object.keys(files),target_SQL:'NOT_RUN',native:'NOT_RUN_NOT_PASS'}));
