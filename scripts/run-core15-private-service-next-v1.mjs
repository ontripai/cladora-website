/** Only this process receives local-development public client selectors. Secret
 * Core credentials stay in the private binding file; no .env/repo config write.
 */
import assert from 'node:assert/strict';
import {readFileSync,openSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const p='/workspace/private/cladora-functional-dev-v1',read=x=>JSON.parse(readFileSync(p+'/'+x));
const identity=read('core15/private-binding-identity.json'),publicClient=read('secrets.json');
const port=Number(process.argv[2]);assert.equal(process.argv.length,3);assert.ok(Number.isInteger(port)&&port>=3001&&port<=3099);
execFileSync('python3',['-I','-B','-c',`import socket;s=socket.socket();assert s.connect_ex(('127.0.0.1',${port}))!=0,'PORT_COLLISION';s.close()`],{stdio:'pipe'});
const next=createRequire(import.meta.url).resolve('next/dist/bin/next');
const log=openSync(p+'/core15/next-service-private.log','a',0o600);
const child=spawn(process.execPath,[next,'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{stdio:['ignore',log,log],env:{...process.env,NODE_ENV:'development',NEXT_PUBLIC_CLADORA_EPHEMERAL_LOCAL_SUPABASE:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55421',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:publicClient.anon_key,CLADORA_CORE15_SERVICE_BINDING_FILE:identity.path,CLADORA_CORE15_SERVICE_BINDING_SHA256:identity.sha256}});
child.on('exit',code=>{process.exitCode=code??1;});
process.once('SIGTERM',()=>child.kill('SIGTERM'));process.once('SIGINT',()=>child.kill('SIGINT'));
