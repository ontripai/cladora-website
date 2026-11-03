/** Operator-only explicit credential provenance. No fallback, discovery or SQL. */
import {openSync,closeSync,fstatSync,readFileSync,writeFileSync,lstatSync,constants} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
const ref='794f5a12c3928ae0a3585ab679a3cbe60aab49a3',profile='platform12-owned-development.ordinary-installer.v1';
export const INSTALLER_BINDING_V1='core-installer-credential-binding.v1';
const need=(ok,code)=>{if(!ok)throw new Error('INSTALLER_BINDING_'+code);};
const sha=x=>createHash('sha256').update(x).digest('hex');
function exact(o,keys){return o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===[...keys].sort().join('|');}
export function installerTargetV1(t){return{backend_id:t.backend_id,database_oid:t.database_oid,database_name:t.database_name,host:t.host,port:t.port,principal:'cladora_core_installer'};}
function targetValid(t){return exact(t,['backend_id','database_oid','database_name','host','port','principal'])&&/^core15-dev:[a-f0-9]{32}$/.test(t.backend_id)&&Number.isSafeInteger(t.database_oid)&&t.database_oid>0&&t.database_name==='postgres'&&t.host==='127.0.0.1'&&t.port===55422&&t.principal==='cladora_core_installer';}
export function readOwnedInstallerFileV1(path,privateRoot){
 const root=resolve(privateRoot),file=resolve(path),rel=relative(root,file);need(rel!==''&&!rel.startsWith('..')&&!rel.startsWith('/'),'PATH');
 let dir=dirname(file);for(;;){const s=lstatSync(dir);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&(s.mode&0o077)===0,'DIRECTORY_CUSTODY');if(dir===root)break;dir=dirname(dir);}
 const fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const s=fstatSync(fd);need(s.isFile()&&s.nlink===1&&s.uid===process.getuid()&&(s.mode&0o077)===0&&s.size<=65536,'FILE_CUSTODY');const bytes=readFileSync(fd);need(bytes.length===s.size,'FILE_CHANGED');return bytes;}finally{closeSync(fd);}
}
function paths(root,generation){need(['v3','historical-v2'].includes(generation),'GENERATION');const dir=resolve(root,'core15',generation==='v3'?'service-native-v3':'service-native-v2');return{credential:dir+'/installer-secret.json',receipt:dir+(generation==='v3'?'/prerequisites-committed.json':'/prerequisites.json'),session:resolve(root,'core15/session-bootstrap-receipt.json'),binding:generation==='v3'?dir+'/installer-binding.json':resolve(root,'core17-historical-installer-binding.json')};}
function producer(root,generation,target){const p=paths(root,generation),receiptRaw=readOwnedInstallerFileV1(p.receipt,root),sessionRaw=readOwnedInstallerFileV1(p.session,root),r=JSON.parse(receiptRaw),s=JSON.parse(sessionRaw);
 need(r.unit==='prerequisites'&&r.state==='COMMIT_ACK_RFQ_I_AND_POSTSTATE_OBSERVED'&&r.settlement==='COMMIT'&&r.command_complete_commit===true&&r.readyforquery==='I'&&r.poststate?.ordinary_installer===true,'PRODUCER_RECEIPT');
 need(s.platform===ref&&s.state==='COMMIT_TAG_AND_INDEPENDENT_CATALOG_OBSERVED'&&s.backend_id===target.backend_id&&Number(s.database_oid)===target.database_oid,'PRODUCER_TARGET');
 return{receipt_path:p.receipt,receipt_sha256:sha(receiptRaw),session_receipt_path:p.session,session_receipt_sha256:sha(sessionRaw)};}
export function issueInstallerCredentialBindingV1({privateRoot,generation,target}){
 need(targetValid(target),'TARGET');const p=paths(privateRoot,generation),provenance=producer(privateRoot,generation,target),raw=readOwnedInstallerFileV1(p.credential,privateRoot),secret=JSON.parse(raw);need(exact(secret,['password'])&&/^[a-f0-9]{64}$/.test(secret.password),'CREDENTIAL_SCHEMA');
 const value={contract:INSTALLER_BINDING_V1,profile,platform:ref,generation,target,credential:{path:p.credential,sha256:sha(raw)},producer:provenance};
 writeFileSync(p.binding,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});return{path:p.binding,sha256:sha(readOwnedInstallerFileV1(p.binding,privateRoot)),generation};
}
export function loadInstallerCredentialBindingV1({privateRoot,generation,bindingPath,expectedTarget}){
 need(targetValid(expectedTarget),'EXPECTED_TARGET');const p=paths(privateRoot,generation);need(resolve(bindingPath)===p.binding,'BINDING_PATH');
 const b=JSON.parse(readOwnedInstallerFileV1(p.binding,privateRoot));need(exact(b,['contract','profile','platform','generation','target','credential','producer'])&&b.contract===INSTALLER_BINDING_V1&&b.profile===profile&&b.platform===ref&&b.generation===generation,'VERSION_PROFILE');
 need(targetValid(b.target)&&Object.keys(expectedTarget).every(k=>b.target[k]===expectedTarget[k]),'TARGET_MISMATCH');
 need(exact(b.credential,['path','sha256'])&&b.credential.path===p.credential&&/^[a-f0-9]{64}$/.test(b.credential.sha256),'CREDENTIAL_PATH');
 const canonical=producer(privateRoot,generation,expectedTarget);need(exact(b.producer,Object.keys(canonical))&&Object.keys(canonical).every(k=>b.producer[k]===canonical[k]),'PROVENANCE_MISMATCH');
 const bytes=readOwnedInstallerFileV1(p.credential,privateRoot);need(sha(bytes)===b.credential.sha256,'CREDENTIAL_IDENTITY');const secret=JSON.parse(bytes);need(exact(secret,['password'])&&/^[a-f0-9]{64}$/.test(secret.password),'CREDENTIAL_SCHEMA');
 const result={principal:expectedTarget.principal,target:Object.freeze({...expectedTarget}),generation,binding_sha256:sha(readOwnedInstallerFileV1(p.binding,privateRoot))};
 Object.defineProperty(result,'password',{value:secret.password,enumerable:false});return Object.freeze(result);
}
