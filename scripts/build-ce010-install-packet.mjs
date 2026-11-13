/** Writes review-only files locally. No database/installer/network operation. */
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCe010Packet} from './lib/ce010-install-packet.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const output=process.argv.find(x=>x.startsWith('--output='))?.slice(9);
if(process.argv.slice(2).length!==1)throw Error('ONLY_ONE_LOCAL_OUTPUT_ARGUMENT_ALLOWED');
if(!output)throw Error('Use --output=/absolute/local/review-directory; this tool never installs');
if(!path.isAbsolute(output))throw Error('ABSOLUTE_LOCAL_OUTPUT_REQUIRED');
const {files,plan}=buildCe010Packet(p=>readFileSync(path.join(root,p)));
const artifacts={...files,'packet.json':JSON.stringify(plan,null,2)+'\n'};
for(const[name,body]of Object.entries(artifacts))if(existsSync(path.join(output,name))&&readFileSync(path.join(output,name),'utf8')!==body)throw Error('PRESERVE_EXISTING_OUTPUT_CONFLICT '+name);
mkdirSync(output,{recursive:true});for(const[name,body]of Object.entries(artifacts))writeFileSync(path.join(output,name),body);
console.log(JSON.stringify({status:'REVIEW_SOURCE_BUILT',files:Object.keys(files),runtime:plan.runtime,native:plan.native}));
